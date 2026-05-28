import { describe, expect, it } from "vitest";
import { trackSpeedsForRiders } from "./trackControl";

describe("trackControl", () => {
  it("assigns drums to the detected drum controller and guitar to the other rider", () => {
    expect(trackSpeedsForRiders(1, "user2", 0.8, 1.3)).toEqual({
      drums: 1.3,
      guitar: 0.8,
      bass: 1.3,
      other: 1.3,
      vocals: 1.3,
    });
  });

  it("keeps all tracks at normal speed in stage 4", () => {
    expect(trackSpeedsForRiders(4, "user2", 0.8, 1.3)).toEqual({
      drums: 1,
      guitar: 1,
      bass: 1,
      other: 1,
      vocals: 1,
    });
  });
});
