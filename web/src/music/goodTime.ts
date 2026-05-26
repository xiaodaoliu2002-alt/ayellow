import manifest from "../../../processed/good-time/manifest.json";
import bass from "../../../processed/good-time/tracks/bass.json";
import drums from "../../../processed/good-time/tracks/drums.json";
import guitar from "../../../processed/good-time/tracks/guitar.json";
import lead from "../../../processed/good-time/tracks/lead.json";
import pad from "../../../processed/good-time/tracks/pad.json";
import piano from "../../../processed/good-time/tracks/piano.json";
import { validateSongManifest, validateTrackData } from "./loadSong";
import type { SongData, TrackId } from "./types";

const trackData = {
  bass: validateTrackData(bass),
  lead: validateTrackData(lead),
  drums: validateTrackData(drums),
  piano: validateTrackData(piano),
  guitar: validateTrackData(guitar),
  pad: validateTrackData(pad),
} satisfies SongData["tracksData"];

export function loadGoodTime(): SongData {
  const songManifest = validateSongManifest(manifest);
  return {
    ...songManifest,
    tracksData: trackData as Record<TrackId, (typeof trackData)[TrackId]>,
  };
}
