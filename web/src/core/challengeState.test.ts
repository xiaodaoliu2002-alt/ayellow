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

  it("accumulates 30 seconds of sync to enter stage 2 and cue speed-up guidance", () => {
    let state = createChallengeState(magicPotion);

    state = updateChallengeState(state, { dtSeconds: 30, synced: true, ridersActive: true, song: magicPotion });

    expect(state.stage).toBe(2);
    expect(state.progressSeconds).toBe(0);
    expect(state.activeTracks).toEqual(["drums", "guitar", "bass"]);
    expect(state.layerVolumes.bass).toBe(1);
    expect(state.cue?.kind).toBe("speedUp");
  });

  it("regresses progress when sync is lost before the next stage", () => {
    let state = createChallengeState(magicPotion);
    state = updateChallengeState(state, { dtSeconds: 12, synced: true, ridersActive: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 5, synced: false, ridersActive: true, song: magicPotion });

    expect(state.stage).toBe(1);
    expect(state.progressSeconds).toBe(7);
  });

  it("enters stage 3 with slow-down guidance after stage 2 is completed", () => {
    let state = createChallengeState(magicPotion);
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, ridersActive: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, ridersActive: true, song: magicPotion });

    expect(state.stage).toBe(3);
    expect(state.activeTracks).toEqual(["drums", "guitar", "bass", "other"]);
    expect(state.cue?.kind).toBe("slowDown");
  });

  it("enters stage 4 with all tracks at full volume after the final 30 seconds", () => {
    let state = createChallengeState(magicPotion);
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, ridersActive: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, ridersActive: true, song: magicPotion });
    state = updateChallengeState(state, { dtSeconds: 30, synced: true, ridersActive: true, song: magicPotion });

    expect(state.stage).toBe(4);
    expect(state.progressSeconds).toBe(30);
    expect(state.activeTracks).toEqual(["drums", "guitar", "bass", "other", "vocals"]);
    expect(state.layerVolumes.vocals).toBe(1);
    expect(state.cue?.kind).toBe("success");
  });
});
