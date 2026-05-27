import type { TrackSpeeds, TrackVolumes } from "./types";
import type { ChallengeCueKind } from "../core/challengeState";
import type { StemTrackConfig, StemTrackId } from "../music/songCatalog";

type PitchPreservingAudio = HTMLAudioElement & {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

type StemRuntime = StemTrackConfig & {
  element: PitchPreservingAudio;
  currentSpeed: number;
  targetSpeed: number;
  currentVolume: number;
  targetVolume: number;
};

const SPEED_MIN = 0.5;
const SPEED_MAX = 1.75;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyPitchPreservation(element: PitchPreservingAudio): void {
  element.preservesPitch = true;
  element.mozPreservesPitch = true;
  element.webkitPreservesPitch = true;
}

function speak(text: string): void {
  if (!("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1.08;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private cueGain: GainNode | null = null;
  private tracks: Map<StemTrackId, StemRuntime> = new Map();
  private trackOrder: StemTrackId[] = [];
  private frame: number | null = null;
  private lastFrameTime = 0;
  private duckUntilTime = 0;

  async start(stems: StemTrackConfig[]): Promise<void> {
    this.stop();
    if (!this.context) {
      this.context = new AudioContext();
      this.cueGain = this.context.createGain();
      this.cueGain.gain.value = 0.8;
      this.cueGain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.trackOrder = stems.map((stem) => stem.id);
    for (const stem of stems) {
      const element = new Audio(stem.path) as PitchPreservingAudio;
      element.loop = true;
      element.preload = "auto";
      element.volume = 0;
      element.playbackRate = 1;
      element.defaultPlaybackRate = 1;
      applyPitchPreservation(element);
      this.tracks.set(stem.id, {
        ...stem,
        element,
        currentSpeed: 1,
        targetSpeed: 1,
        currentVolume: 0,
        targetVolume: 0,
      });
    }

    await Promise.all([...this.tracks.values()].map((runtime) => runtime.element.play()));
    this.lastFrameTime = performance.now();
    this.frame = window.requestAnimationFrame((time) => this.tick(time));
  }

  stop(): void {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    for (const runtime of this.tracks.values()) {
      runtime.element.pause();
      runtime.element.currentTime = 0;
      runtime.element.src = "";
      runtime.element.load();
    }
    this.tracks.clear();
    this.trackOrder = [];
  }

  setTrackSpeeds(speeds: TrackSpeeds): void {
    for (const track of this.trackOrder) {
      const runtime = this.tracks.get(track);
      const speed = speeds[track];
      if (!runtime || speed === undefined || !Number.isFinite(speed)) {
        continue;
      }
      runtime.targetSpeed = clamp(speed, SPEED_MIN, SPEED_MAX);
    }
  }

  setLayerVolumes(volumes: TrackVolumes): void {
    for (const track of this.trackOrder) {
      const runtime = this.tracks.get(track);
      if (!runtime) {
        continue;
      }
      const volume = volumes[track] ?? 0;
      runtime.targetVolume = Number.isFinite(volume) ? clamp(volume, 0, 1) : 0;
    }
  }

  syncToStem(referenceId: StemTrackId = "drums"): void {
    const reference = this.tracks.get(referenceId);
    if (!reference || !Number.isFinite(reference.element.currentTime)) {
      return;
    }
    const referenceTime = reference.element.currentTime;
    for (const runtime of this.tracks.values()) {
      if (runtime.id === referenceId || !Number.isFinite(runtime.element.duration) || runtime.element.duration <= 0) {
        continue;
      }
      runtime.element.currentTime = referenceTime % runtime.element.duration;
    }
  }

  playStageCue(kind: ChallengeCueKind, guideBpm = 110): void {
    if (!this.context || !this.cueGain) {
      return;
    }
    const now = this.context.currentTime + 0.03;
    if (kind === "unlock") {
      this.playSparkle(now, 0.5);
      return;
    }
    if (kind === "speedUp") {
      this.playRiser(now);
      speak("加速冲冲冲！");
      this.playPulseTrain(now + 0.62, 15, guideBpm, 86, "up");
      return;
    }
    if (kind === "slowDown") {
      this.playDowner(now);
      speak("减速放轻松");
      this.playPulseTrain(now + 0.62, 15, guideBpm, 62, "down");
      return;
    }

    this.playSuccess(now);
  }

  private playPulseTrain(startTime: number, count: number, bpm: number, note: number, direction: "up" | "down"): void {
    const intervalSeconds = 60 / clamp(bpm, 60, 180);
    this.duckUntilTime = Math.max(this.duckUntilTime, startTime + count * intervalSeconds + 0.9);
    for (let index = 0; index < count; index += 1) {
      const pitch = direction === "up" ? note + (index % 3) * 2 : note - (index % 3) * 2;
      this.playTone(pitch, startTime + index * intervalSeconds, Math.min(0.12, intervalSeconds * 0.38), 0.32);
    }
  }

  private playSparkle(startTime: number, velocity: number): void {
    this.playTone(76, startTime, 0.18, velocity * 0.55);
    this.playTone(83, startTime + 0.08, 0.22, velocity * 0.48);
    this.playTone(88, startTime + 0.18, 0.34, velocity * 0.42);
  }

  private playRiser(startTime: number): void {
    this.playTone(72, startTime, 0.18, 0.34);
    this.playTone(79, startTime + 0.1, 0.2, 0.38);
    this.playTone(86, startTime + 0.22, 0.28, 0.42);
  }

  private playDowner(startTime: number): void {
    this.playTone(74, startTime, 0.2, 0.34);
    this.playTone(67, startTime + 0.12, 0.24, 0.32);
    this.playTone(62, startTime + 0.26, 0.36, 0.3);
  }

  private playSuccess(startTime: number): void {
    this.playTone(72, startTime, 0.2, 0.38);
    this.playTone(76, startTime + 0.08, 0.24, 0.34);
    this.playTone(79, startTime + 0.16, 0.3, 0.36);
    this.playTone(84, startTime + 0.26, 0.52, 0.42);
  }

  private playTone(note: number, startTime: number, duration: number, velocity: number): void {
    if (!this.context || !this.cueGain) {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440 * 2 ** ((note - 69) / 12), startTime);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3600, startTime);
    filter.Q.setValueAtTime(0.5, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity), startTime + 0.018);
    gain.gain.setValueAtTime(Math.max(0.0001, velocity * 0.82), startTime + Math.max(0.02, duration * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.cueGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.04);
  }

  private tick(time: number): void {
    const dtSeconds = Math.max(0.001, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;
    const speedEase = 1 - Math.exp(-dtSeconds / 0.65);
    const volumeEase = 1 - Math.exp(-dtSeconds / 0.22);
    const duckFactor = this.context && this.context.currentTime < this.duckUntilTime ? 0.38 : 1;

    for (const runtime of this.tracks.values()) {
      runtime.currentSpeed += (runtime.targetSpeed - runtime.currentSpeed) * speedEase;
      runtime.currentVolume += (runtime.targetVolume - runtime.currentVolume) * volumeEase;
      const nextSpeed = clamp(runtime.currentSpeed, SPEED_MIN, SPEED_MAX);
      runtime.element.playbackRate = nextSpeed;
      runtime.element.defaultPlaybackRate = nextSpeed;
      runtime.element.volume = clamp(runtime.currentVolume * duckFactor, 0, 1);
    }

    this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
  }
}
