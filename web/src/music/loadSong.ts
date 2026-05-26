import type { SongManifest, TrackData, TrackId } from "./types";

const TRACK_IDS: TrackId[] = ["bass", "lead", "drums", "piano", "guitar", "pad"];

export function validateSongManifest(value: unknown): SongManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Song manifest must be an object");
  }

  const manifest = value as SongManifest;
  if (!manifest.id || !manifest.title || !manifest.artist) {
    throw new Error("Song manifest is missing identity fields");
  }
  if (!Number.isFinite(manifest.baseBpm) || manifest.baseBpm <= 0) {
    throw new Error("Song manifest baseBpm must be positive");
  }
  if (!Number.isFinite(manifest.loopBeats) || manifest.loopBeats <= 0) {
    throw new Error("Song manifest loopBeats must be positive");
  }
  if (JSON.stringify(manifest.trackOrder) !== JSON.stringify(TRACK_IDS)) {
    throw new Error("Song manifest trackOrder must match the Good Time arrangement");
  }
  if (!Array.isArray(manifest.tracks) || manifest.tracks.length !== TRACK_IDS.length) {
    throw new Error("Song manifest must include all tracks");
  }

  return manifest;
}

export function validateTrackData(value: unknown): TrackData {
  if (!value || typeof value !== "object") {
    throw new Error("Track data must be an object");
  }

  const track = value as TrackData;
  if (!TRACK_IDS.includes(track.id)) {
    throw new Error(`Unexpected track id ${track.id}`);
  }
  if (!Array.isArray(track.events)) {
    throw new Error(`Track ${track.id} is missing events`);
  }
  for (const event of track.events) {
    if (!Number.isFinite(event.beat) || !Number.isFinite(event.duration) || !Number.isFinite(event.note)) {
      throw new Error(`Track ${track.id} has an invalid note event`);
    }
  }
  return track;
}
