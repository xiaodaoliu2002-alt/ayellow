import type { TrackSpeeds, TrackVolumes } from "./types";
import { cueAssetForKind, guideBpmForKind, type GuideBpmSettings } from "./cues";
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
const CUE_KINDS: ChallengeCueKind[] = ["unlock", "speedUp", "slowDown", "success"];
const DEFAULT_GUIDE_BPM: GuideBpmSettings = { speedUp: 124, slowDown: 86 };
const GUIDE_PULSE_COUNT = 15;
const CUE_DUCK_SECONDS = 2.4;
const DUCK_FACTOR = 0.22;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyPitchPreservation(element: PitchPreservingAudio): void {
  element.preservesPitch = true;
  element.mozPreservesPitch = true;
  element.webkitPreservesPitch = true;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private cueGain: GainNode | null = null;
  private cueTemplates: Map<ChallengeCueKind, HTMLAudioElement> = new Map();
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
      this.cueGain.gain.value = 1;
      this.cueGain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    this.prepareCueAssets();

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

  playStageCue(kind: ChallengeCueKind, guideBpm: GuideBpmSettings = DEFAULT_GUIDE_BPM): HTMLAudioElement | null {
    if (!this.context || !this.cueGain) {
      return null;
    }
    const now = this.context.currentTime + 0.03;
    this.duckBackgroundUntil(now + CUE_DUCK_SECONDS);
    const cue = this.playCueAsset(kind);

    const bpm = guideBpmForKind(kind, guideBpm);
    if (bpm === null) {
      return cue;
    }
    this.playPulseTrain(now + 0.9, GUIDE_PULSE_COUNT, bpm, kind === "speedUp" ? "up" : "down");
    return cue;
  }

  private prepareCueAssets(): void {
    for (const kind of CUE_KINDS) {
      if (!this.cueTemplates.has(kind)) {
        const audio = new Audio(cueAssetForKind(kind));
        audio.preload = "auto";
        audio.volume = 1;
        this.cueTemplates.set(kind, audio);
      }
    }
  }

  private playCueAsset(kind: ChallengeCueKind): HTMLAudioElement {
    const template = this.cueTemplates.get(kind) ?? new Audio(cueAssetForKind(kind));
    const cue = template.cloneNode(true) as HTMLAudioElement;
    cue.volume = 1;
    cue.currentTime = 0;
    void cue.play().catch(() => {
      this.playGuideHit(this.context?.currentTime ?? 0, kind === "slowDown" ? "down" : "up", true);
    });
    return cue;
  }

  private duckBackgroundUntil(untilTime: number): void {
    this.duckUntilTime = Math.max(this.duckUntilTime, untilTime);
  }

  private playPulseTrain(startTime: number, count: number, bpm: number, direction: "up" | "down"): void {
    const intervalSeconds = 60 / clamp(bpm, 60, 180);
    this.duckBackgroundUntil(startTime + count * intervalSeconds + 0.9);
    for (let index = 0; index < count; index += 1) {
      this.playGuideHit(startTime + index * intervalSeconds, direction, index % 4 === 0);
    }
  }

  private playGuideHit(startTime: number, direction: "up" | "down", accented: boolean): void {
    if (!this.context || !this.cueGain) {
      return;
    }
    const frequency = direction === "up" ? 1280 : 760;
    const duration = accented ? 0.14 : 0.1;
    const velocity = accented ? 0.95 : 0.74;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, startTime);
    filter.Q.setValueAtTime(10, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(velocity, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.cueGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
    this.playNoiseClick(startTime, accented ? 0.32 : 0.22);
  }

  private playNoiseClick(startTime: number, velocity: number): void {
    if (!this.context || !this.cueGain) {
      return;
    }
    const duration = 0.045;
    const frameCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const fade = 1 - index / frameCount;
      samples[index] = (Math.random() * 2 - 1) * fade * fade;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2800, startTime);
    gain.gain.setValueAtTime(velocity, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.cueGain);
    source.start(startTime);
  }

  private tick(time: number): void {
    const dtSeconds = Math.max(0.001, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;
    const speedEase = 1 - Math.exp(-dtSeconds / 0.65);
    const volumeEase = 1 - Math.exp(-dtSeconds / 0.22);
    const duckFactor = this.context && this.context.currentTime < this.duckUntilTime ? DUCK_FACTOR : 1;

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
