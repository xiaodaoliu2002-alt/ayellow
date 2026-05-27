import { describe, expect, it } from "vitest";
import { createChallengeState, updateChallengeState } from "./challengeState";
import { SONGS } from "../music/songCatalog";

const magicPotion = SONGS[0];

describe("challengeState", () => {
  it("starts in stage 1 with no audible tracks until both riders are active", () => {
    const state = createChallengeState(magicPotion);

    expect(state.stage).toBe(1);
    expect(state.progressSeconds).toBe(0);
    expect(state.layerVolumes.drums).toBe(0);
    expect(state.layerVolumes.guitar).toBe(0);
    expect(state.activeTracks).toEqual(["drums", "guitar"]);
  });

  it("lets each rider hear their own base track once that rider is active", () => {
    const onlyDrums = updateChallengeState(createChallengeState(magicPotion), {
      dtSeconds: 1,
      synced: false,
      rider1Active: true,
      rider2Active: false,
      song: magicPotion,
    });
    const onlyGuitar = updateChallengeState(createChallengeState(magicPotion), {
      dtSeconds: 1,
      synced: false,
      rider1Active: false,
      rider2Active: true,
      song: magicPotion,
    });

    expect(onlyDrums.layerVolumes.drums).toBe(1);
    expect(onlyDrums.layerVolumes.guitar).toBe(0);
    expect(onlyGuitar.layerVolumes.drums).toBe(0);
    expect(onlyGuitar.layerVolumes.guitar).toBe(1);
  });

  it("accumulates 30 seconds of sync to enter stage 2 and hold the current speed", () => {
    let state = createChallengeState(magicPotion);

    state = updateChallengeState(state, { dtSeconds: 30, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });

    expect(state.stage).toBe(2);
    expect(state.progressSeconds).toBe(0);
    expect(state.holdSecondsRemaining).toBe(8);
    expect(state.activeTracks).toEqual(["drums", "guitar", "bass"]);
    expect(state.layerVolumes.bass).toBe(1);
    expect(state.cue?.kind).toBe("unlock");
  });

  it("does not count next-stage sync time during the 8 second hold, then cues acceleration", () => {
    let state = createChallengeState(magicPotion);
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
    let state = createChallengeState(magicPotion);
    state = updateChallengeState(state, { dtSeconds: 12, synced: true, rider1Active: true, rider2Active: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 5, synced: false, rider1Active: true, rider2Active: true, song: magicPotion });

    expect(state.stage).toBe(1);
    expect(state.progressSeconds).toBe(7);
  });

  it("enters stage 3 with another hold before slow-down guidance", () => {
    let state = createChallengeState(magicPotion);
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
    let state = createChallengeState(magicPotion);
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
