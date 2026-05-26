import { describe, expect, it } from "vitest";
import { createSyncState, type SyncState, updateSyncState } from "./syncState";

function advanceSynced(state: SyncState, seconds: number): SyncState {
  let next = state;
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.25) {
    next = updateSyncState(next, {
      dtSeconds: 0.25,
      rider1CadenceRpm: 80,
      rider2CadenceRpm: 81,
      rider1Online: true,
      rider2Online: true,
      rider1Confidence: 0.95,
      rider2Confidence: 0.95,
      rider1Phase: 0.12,
      rider2Phase: 0.16,
    });
  }
  return next;
}

describe("syncState", () => {
  it("starts with drums for user 1 and bass for user 2", () => {
    const state = createSyncState();

    expect(state.unlockedTracks).toEqual(["drums", "bass"]);
    expect(state.layerVolumes.drums).toBe(1);
    expect(state.layerVolumes.bass).toBe(1);
    expect(state.layerVolumes.lead).toBe(0);
    expect(state.nextUnlockSeconds).toBe(60);
  });

  it("unlocks reward layers at sustained sync thresholds", () => {
    let state = createSyncState();

    state = advanceSynced(state, 59);
    expect(state.unlockedTracks).toEqual(["drums", "bass"]);

    state = advanceSynced(state, 1);
    expect(state.unlockedTracks).toEqual(["drums", "bass", "lead"]);

    state = advanceSynced(state, 60);
    expect(state.unlockedTracks).toEqual(["drums", "bass", "lead", "piano"]);

    state = advanceSynced(state, 60);
    expect(state.unlockedTracks).toContain("guitar");

    state = advanceSynced(state, 60);
    expect(state.unlockedTracks).toContain("pad");
  });

  it("fades reward volumes when riders fall out of sync", () => {
    let state = createSyncState();
    state = advanceSynced(state, 210);

    const faded = updateSyncState(state, {
      dtSeconds: 10,
      rider1CadenceRpm: 60,
      rider2CadenceRpm: 100,
      rider1Online: true,
      rider2Online: true,
      rider1Confidence: 0.95,
      rider2Confidence: 0.95,
      rider1Phase: 0.1,
      rider2Phase: 0.12,
    });

    expect(faded.synced).toBe(false);
    expect(faded.layerVolumes.lead).toBeLessThan(1);
    expect(faded.layerVolumes.drums).toBe(1);
    expect(faded.layerVolumes.bass).toBe(1);
  });

  it("rejects clearly different raw cadences instead of comparing clamped playback speed", () => {
    const state = updateSyncState(createSyncState(), {
      dtSeconds: 6,
      rider1CadenceRpm: 55,
      rider2CadenceRpm: 92,
      rider1Online: true,
      rider2Online: true,
      rider1Confidence: 0.95,
      rider2Confidence: 0.95,
      rider1Phase: 0.2,
      rider2Phase: 0.22,
    });

    expect(state.synced).toBe(false);
    expect(state.reason).toBe("速度差太大");
  });

  it("allows a wider manually selected sync window", () => {
    const state = updateSyncState(createSyncState(), {
      dtSeconds: 6,
      rider1CadenceRpm: 80,
      rider2CadenceRpm: 90,
      rider1Online: true,
      rider2Online: true,
      rider1Confidence: 0.95,
      rider2Confidence: 0.95,
      rider1Phase: 0.2,
      rider2Phase: 0.22,
      cadenceDeltaRpmThreshold: 12,
      tempoThreshold: 0.15,
    });

    expect(state.synced).toBe(true);
  });

  it("rejects riders with matching average cadence but unstable motion", () => {
    let state = createSyncState();
    for (let index = 0; index < 32; index += 1) {
      state = updateSyncState(state, {
        dtSeconds: 0.25,
        rider1CadenceRpm: index % 2 === 0 ? 65 : 95,
        rider2CadenceRpm: 80,
        rider1Online: true,
        rider2Online: true,
        rider1Confidence: 0.95,
        rider2Confidence: 0.95,
        rider1Phase: 0.1,
        rider2Phase: 0.12,
      });
    }

    expect(state.synced).toBe(false);
    expect(state.reason).toBe("节奏不稳定");
  });

  it("rejects matching tempo when the two rhythms are out of phase", () => {
    let state = createSyncState();
    for (let index = 0; index < 32; index += 1) {
      state = updateSyncState(state, {
        dtSeconds: 0.25,
        rider1CadenceRpm: 80,
        rider2CadenceRpm: 80,
        rider1Online: true,
        rider2Online: true,
        rider1Confidence: 0.95,
        rider2Confidence: 0.95,
        rider1Phase: 0.05,
        rider2Phase: 0.42,
      });
    }

    expect(state.synced).toBe(false);
    expect(state.reason).toBe("节拍没对齐");
  });

  it("keeps riding mode strict when confidence or phase is missing", () => {
    const state = updateSyncState(createSyncState(), {
      dtSeconds: 1,
      rider1CadenceRpm: 75,
      rider2CadenceRpm: 78,
      rider1Online: true,
      rider2Online: true,
      rider1Confidence: 0.35,
      rider2Confidence: 0.35,
      rider1Phase: null,
      rider2Phase: null,
      cadenceDeltaRpmThreshold: 10,
      tempoThreshold: 0.1,
      requirePhase: true,
      confidenceThreshold: 0.6,
    });

    expect(state.synced).toBe(false);
    expect(state.reason).toBe("数据不稳");
  });

  it("allows experiment mode to sync hand-shaken cadence without phase", () => {
    const state = updateSyncState(createSyncState(), {
      dtSeconds: 1,
      rider1CadenceRpm: 75,
      rider2CadenceRpm: 82,
      rider1Online: true,
      rider2Online: true,
      rider1Confidence: 0.35,
      rider2Confidence: 0.35,
      rider1Phase: null,
      rider2Phase: null,
      cadenceDeltaRpmThreshold: 10,
      tempoThreshold: 0.1,
      confidenceThreshold: 0.2,
      requirePhase: false,
      minCadenceRpm: 10,
    });

    expect(state.synced).toBe(true);
  });
});
