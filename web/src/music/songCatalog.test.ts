import { describe, expect, it } from "vitest";
import { SONGS } from "./songCatalog";

describe("songCatalog", () => {
  it("offers the two requested songs with the same stage arrangement", () => {
    expect(SONGS.map((song) => song.id)).toEqual(["magic-potion", "pavement-daybreak"]);

    for (const song of SONGS) {
      expect(song.baseTracks).toEqual(["drums", "guitar"]);
      expect(song.rewardTracks).toEqual(["bass", "other", "vocals"]);
      expect(song.tracks.map((track) => track.id)).toEqual(["drums", "guitar", "bass", "other", "vocals"]);
    }
  });
});
