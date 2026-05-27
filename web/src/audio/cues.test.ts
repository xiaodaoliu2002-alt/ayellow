import { describe, expect, it } from "vitest";
import { cueAssetForKind, guideBpmForKind, type GuideBpmSettings } from "./cues";

describe("cueAssetForKind", () => {
  it("maps challenge cues to the supplied audio files", () => {
    expect(cueAssetForKind("unlock")).toBe("/audio/cues/提示音1.mp3");
    expect(cueAssetForKind("speedUp")).toBe("/audio/cues/加速.mp3");
    expect(cueAssetForKind("slowDown")).toBe("/audio/cues/减速.mp3");
    expect(cueAssetForKind("success")).toBe("/audio/cues/挑战成功.mp3");
  });
});

describe("guideBpmForKind", () => {
  it("uses separate guide BPM values for acceleration and deceleration", () => {
    const settings: GuideBpmSettings = { speedUp: 128, slowDown: 84 };

    expect(guideBpmForKind("speedUp", settings)).toBe(128);
    expect(guideBpmForKind("slowDown", settings)).toBe(84);
    expect(guideBpmForKind("unlock", settings)).toBeNull();
    expect(guideBpmForKind("success", settings)).toBeNull();
  });
});
