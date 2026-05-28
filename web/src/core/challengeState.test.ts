import { describe, expect, it } from "vitest";
import { createChallengeState, updateChallengeState, type ChallengeState } from "./challengeState";
import { SONGS } from "../music/songCatalog";

const magicPotion = SONGS[0];
const readyForStage1 = (): ChallengeState => ({ ...createChallengeState(magicPotion), preStageSecondsRemaining: 0, drumController: "user1" });

describe("challengeState", () => {
  it("starts in stage 1 with no audible tracks until both riders are active", () => {
    const state = createChallengeState(magicPotion);

    expect(state.stage).toBe(1);
    expect(state.progressSeconds).toBe(0);
    expect(state.layerVolumes.drums).toBe(0);
    expect(state.layerVolumes.guitar).toBe(0);
    expect(state.activeTracks).toEqual(["drums", "guitar"]);
  });

  it("spends 15 seconds before stage 1 detecting the faster rider as the drum controller", () => {
    let state = createChallengeState(magicPotion);

    state = updateChallengeState(state, {
      dtSeconds: 10,
      synced: false,
      rider1Active: true,
      rider2Active: true,
      rider1CadenceRpm: 90,
      rider2CadenceRpm: 60,
      song: magicPotion,
    });
    state = updateChallengeState(state, {
      dtSeconds: 5,
      synced: false,
      rider1Active: true,
      rider2Active: true,
      rider1CadenceRpm: 70,
      rider2CadenceRpm: 110,
      song: magicPotion,
    });

    expect(state.preStageSecondsRemaining).toBe(0);
    expect(state.drumController).toBe("user1");
    expect(state.progressSeconds).toBe(0);
  });

  it("does not start stage 1 progress during the pre-stage detection window", () => {
    let state = createChallengeState(magicPotion);

    state = updateChallengeState(state, {
      dtSeconds: 14,
      synced: true,
      rider1Active: true,
      rider2Active: true,
      rider1CadenceRpm: 70,
      rider2CadenceRpm: 80,
      song: magicPotion,
    });

    expect(state.preStageSecondsRemaining).toBe(1);
    expect(state.drumController).toBeNull();
    expect(state.progressSeconds).toBe(0);
    expect(state.stage).toBe(1);
  });

  it("lets the drum controller hear drums and the other rider hear guitar once riders are active", () => {
    const onlyUser1 = updateChallengeState({ ...createChallengeState(magicPotion), preStageSecondsRemaining: 0, drumController: "user2" }, {
      dtSeconds: 1,
      synced: false,
      rider1Active: true,
      rider2Active: false,
      song: magicPotion,
    });
    const onlyUser2 = updateChallengeState({ ...createChallengeState(magicPotion), preStageSecondsRemaining: 0, drumController: "user2" }, {
      dtSeconds: 1,
      synced: false,
      rider1Active: false,
      rider2Active: true,
      song: magicPotion,
    });

    expect(onlyUser1.layerVolumes.drums).toBe(0);
    expect(onlyUser1.layerVolumes.guitar).toBe(1);
    expect(onlyUser2.layerVolumes.drums).toBe(1);
    expect(onlyUser2.layerVolumes.guitar).toBe(0);
  });

  it("accumulates 30 seconds of sync to enter stage 2 and hold the current speed", () => {
    let state = readyForStage1();

    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });

    expect(state.stage).toBe(2);
    expect(state.progressSeconds).toBe(0);
    expect(state.holdSecondsRemaining).toBe(8);
    expect(state.activeTracks).toEqual(["drums", "guitar", "bass"]);
    expect(state.layerVolumes.bass).toBe(1);
    expect(state.cue?.kind).toBe("unlock");
  });

  it("does not count next-stage sync time during the 8 second hold, then cues acceleration", () => {
    let state = readyForStage1();
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });

    state = updateChallengeState(state, { dtSeconds: 7, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    expect(state.stage).toBe(2);
    expect(state.progressSeconds).toBe(0);
    expect(state.holdSecondsRemaining).toBe(1);
    expect(state.cue).toBeNull();

    state = updateChallengeState(state, { dtSeconds: 1, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    expect(state.stage).toBe(2);
    expect(state.progressSeconds).toBe(0);
    expect(state.holdSecondsRemaining).toBe(0);
    expect(state.cue?.kind).toBe("speedUp");
  });

  it("regresses progress when sync is lost before the next stage", () => {
    let state = readyForStage1();
    state = updateChallengeState(state, { dtSeconds: 12, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 5, synced: false, rider1Active: true, rider2Active: true, song: magicPotion });

    expect(state.stage).toBe(1);
    expect(state.progressSeconds).toBe(7);
  });

  it("enters stage 3 with another hold before slow-down guidance", () => {
    let state = readyForStage1();
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 8, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });

    expect(state.stage).toBe(3);
    expect(state.activeTracks).toEqual(["drums", "guitar", "bass", "other"]);
    expect(state.holdSecondsRemaining).toBe(8);
    expect(state.cue?.kind).toBe("unlock");

    state = updateChallengeState(state, { dtSeconds: 8, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    expect(state.cue?.kind).toBe("slowDown");
  });

  it("enters stage 4 with all tracks at full volume after the final 30 seconds", () => {
    let state = readyForStage1();
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 8, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 8, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });

    expect(state.stage).toBe(4);
    expect(state.progressSeconds).toBe(30);
    expect(state.holdSecondsRemaining).toBe(0);
    expect(state.activeTracks).toEqual(["drums", "guitar", "bass", "other", "vocals"]);
    expect(state.layerVolumes.vocals).toBe(1);
    expect(state.cue?.kind).toBe("success");
  });
});
