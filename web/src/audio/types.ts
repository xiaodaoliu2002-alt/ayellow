import type { NoteEvent, SynthType, TrackId } from "../music/types";

export interface ScheduledTrack {
  id: TrackId;
  synth: SynthType;
  loopBeats: number;
  events: NoteEvent[];
}

export type TrackVolumes = Record<TrackId, number>;
export type TrackBpms = Record<TrackId, number>;
export type TrackSpeeds = Record<TrackId, number>;
