export type TrackId = "bass" | "lead" | "drums" | "piano" | "guitar" | "pad";
export type SynthType = "bass" | "lead" | "drums" | "piano" | "pluck" | "pad";

export interface NoteEvent {
  beat: number;
  duration: number;
  note: number;
  velocity: number;
  drum?: "kick" | "snare" | "hat";
}

export interface TrackManifest {
  id: TrackId;
  name: string;
  role: "base" | "reward";
  synth: SynthType;
  path: string;
}

export interface SongManifest {
  id: string;
  title: string;
  artist: string;
  baseBpm: number;
  loopBeats: number;
  trackOrder: TrackId[];
  tracks: TrackManifest[];
}

export interface TrackData extends TrackManifest {
  loopBeats: number;
  events: NoteEvent[];
}

export interface SongData extends SongManifest {
  tracksData: Record<TrackId, TrackData>;
}
