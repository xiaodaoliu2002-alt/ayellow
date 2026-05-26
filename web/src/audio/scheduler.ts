import type { SongData } from "../music/types";
import type { ScheduledTrack } from "./types";

export function scheduledTracksFromSong(song: SongData): ScheduledTrack[] {
  return song.trackOrder.map((trackId) => {
    const track = song.tracksData[trackId];
    return {
      id: track.id,
      synth: track.synth,
      loopBeats: track.loopBeats,
      events: [...track.events].sort((a, b) => a.beat - b.beat),
    };
  });
}
