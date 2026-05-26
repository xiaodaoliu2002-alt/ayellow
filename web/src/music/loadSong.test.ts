import { describe, expect, it } from "vitest";
import manifest from "../../../processed/good-time/manifest.json";
import { validateSongManifest } from "./loadSong";

describe("validateSongManifest", () => {
  it("accepts the Good Time manifest shape", () => {
    expect(validateSongManifest(manifest).trackOrder).toEqual(["bass", "lead", "drums", "piano", "guitar", "pad"]);
  });
});
