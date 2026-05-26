import { playCue } from "./synths";
import type { TrackSpeeds, TrackVolumes } from "./types";
import type { TrackId } from "../music/types";

type PitchPreservingAudio = HTMLAudioElement & {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

interface StemTrack {
  id: TrackId;
  path: string;
}

type StemRuntime = StemTrack & {
  element: PitchPreservingAudio;
  currentSpeed: number;
  targetSpeed: number;
  currentVolume: number;
  targetVolume: number;
};

const STEMS: StemTrack[] = [
  { id: "bass", path: "/audio/good-time/bass.mp3" },
  { id: "lead", path: "/audio/good-time/vocals.mp3" },
  { id: "drums", path: "/audio/good-time/drums.mp3" },
  { id: "piano", path: "/audio/good-time/piano.mp3" },
  { id: "guitar", path: "/audio/good-time/guitar.mp3" },
  { id: "pad", path: "/audio/good-time/other.mp3" },
];

const SPEED_MIN = 0.5;
const SPEED_MAX = 1.75;
const TRACKS: TrackId[] = ["bass", "lead", "drums", "piano", "guitar", "pad"];

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
  private tracks: Map<TrackId, StemRuntime> = new Map();
  private frame: number | null = null;
  private lastFrameTime = 0;

  async start(): Promise<void> {
    this.stop();
    if (!this.context) {
      this.context = new AudioContext();
      this.cueGain = this.context.createGain();
      this.cueGain.gain.value = 0.7;
      this.cueGain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    for (const stem of STEMS) {
      const element = new Audio(stem.path) as PitchPreservingAudio;
      element.loop = true;
      element.preload = "auto";
      element.volume = stem.id === "drums" || stem.id === "bass" ? 1 : 0;
      element.playbackRate = 1;
      element.defaultPlaybackRate = 1;
      applyPitchPreservation(element);
      this.tracks.set(stem.id, {
        ...stem,
        element,
        currentSpeed: 1,
        targetSpeed: 1,
        currentVolume: element.volume,
        targetVolume: element.volume,
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
  }

  setTrackSpeeds(speeds: Partial<TrackSpeeds>): void {
    for (const track of TRACKS) {
      const runtime = this.tracks.get(track);
      const speed = speeds[track];
      if (!runtime || speed === undefined || !Number.isFinite(speed)) {
        continue;
      }
      runtime.targetSpeed = clamp(speed, SPEED_MIN, SPEED_MAX);
    }
  }

  setLayerVolumes(volumes: Partial<TrackVolumes>): void {
    for (const track of TRACKS) {
      const runtime = this.tracks.get(track);
      const volume = volumes[track];
      if (!runtime || volume === undefined || !Number.isFinite(volume)) {
        continue;
      }
      runtime.targetVolume = clamp(volume, 0, 1);
    }
  }

  syncToStem(referenceId: TrackId = "bass"): void {
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

  cue(): void {
    if (this.context && this.cueGain) {
      playCue(this.context, this.cueGain);
    }
  }

  private tick(time: number): void {
    const dtSeconds = Math.max(0.001, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;
    const speedEase = 1 - Math.exp(-dtSeconds / 0.65);
    const volumeEase = 1 - Math.exp(-dtSeconds / 0.22);

    for (const runtime of this.tracks.values()) {
      runtime.currentSpeed += (runtime.targetSpeed - runtime.currentSpeed) * speedEase;
      runtime.currentVolume += (runtime.targetVolume - runtime.currentVolume) * volumeEase;
      const nextSpeed = clamp(runtime.currentSpeed, SPEED_MIN, SPEED_MAX);
      runtime.element.playbackRate = nextSpeed;
      runtime.element.defaultPlaybackRate = nextSpeed;
      runtime.element.volume = clamp(runtime.currentVolume, 0, 1);
    }

    this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
  }
}
