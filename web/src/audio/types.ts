import type { NoteEvent, SynthType, TrackId } from "../music/types";
import type { StemTrackId } from "../music/songCatalog";

export interface ScheduledTrack {
  id: TrackId;
  synth: SynthType;
  loopBeats: number;
  events: NoteEvent[];
}

export type TrackVolumes = Partial<Record<StemTrackId, number>>;
export type TrackBpms = Partial<Record<StemTrackId, number>>;
export type TrackSpeeds = Partial<Record<StemTrackId, number>>;
