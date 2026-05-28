import { describe, expect, it } from "vitest";
import { startCountdownAnimationUpdate } from "./startCountdownSignal";

describe("startCountdownSignal", () => {
  it("starts the M5Stack countdown immediately when audio starts", () => {
    expect(startCountdownAnimationUpdate(15)).toEqual({
      stage: 1,
      progress: 0,
      countdownRemainingSeconds: 15,
      stage4Video: "idle",
    });
  });
});
