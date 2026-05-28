import { describe, expect, it } from "vitest";
import { createChallengeState, updateChallengeState, type ChallengeState } from "./challengeState";
import { m5stackAnimationUpdate, stageProgressRatio } from "./m5stackAnimationSignal";
import { SONGS } from "../music/songCatalog";

const song = SONGS[0];
const readyForStage1 = (): ChallengeState => ({ ...createChallengeState(song), preStageSecondsRemaining: 0, drumController: "user1" });

describe("m5stackAnimationSignal", () => {
  it("reports bottom-to-top progress during each pre-final stage", () => {
    const state = updateChallengeState(readyForStage1(), {
      dtSeconds: 15,
      synced: true,
      rider1Active: true,
      rider2Active: true,
      song,
    });

    expect(stageProgressRatio(state)).toBe(0.5);
  });

  it("starts congratulations only when entering the next stage", () => {
    const previous = updateChallengeState(readyForStage1(), {
      dtSeconds: 29,
      synced: true,
      rider1Active: true,
      rider2Active: true,
      song,
    });
    const next = updateChallengeState(previous, {
      dtSeconds: 1,
      synced: true,
      rider1Active: true,
      rider2Active: true,
      song,
    });

    expect(m5stackAnimationUpdate(previous, next)).toMatchObject({
      stage: 2,
      progress: 0,
      congratulations: "playing",
      stage4Video: "idle",
    });
  });

  it("does not start congratulations just because progress is accumulating", () => {
    const previous = readyForStage1();
    const next = updateChallengeState(previous, {
      dtSeconds: 1,
      synced: true,
      rider1Active: true,
      rider2Active: true,
      song,
    });

    expect(m5stackAnimationUpdate(previous, next).congratulations).toBeUndefined();
  });

  it("keeps the stage 4 video idle before the final stage", () => {
    const previous = readyForStage1();
    const next = updateChallengeState(previous, {
      dtSeconds: 1,
      synced: true,
      rider1Active: true,
      rider2Active: true,
      song,
    });

    expect(m5stackAnimationUpdate(previous, next).stage4Video).toBe("idle");
  });

  it("starts the stage 4 video loop after entering stage 4", () => {
    let state = readyForStage1();
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song });
    state = updateChallengeState(state, { dtSeconds: 8, synced: true, rider1Active: true, rider2Active: true, song });
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song });
    state = updateChallengeState(state, { dtSeconds: 8, synced: true, rider1Active: true, rider2Active: true, song });
    const next = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song });

    expect(m5stackAnimationUpdate(state, next)).toMatchObject({
      stage: 4,
      progress: 1,
      stage4Video: "playing",
    });
  });
});
