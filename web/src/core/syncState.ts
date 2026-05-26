export type TrackId = "bass" | "lead" | "drums" | "piano" | "guitar" | "pad";

export interface SyncState {
  synced: boolean;
  syncedSeconds: number;
  unlockedTracks: TrackId[];
  layerVolumes: Record<TrackId, number>;
  nextUnlockSeconds: number | null;
  reason: string;
  lastCueTrack: TrackId | null;
  tempoDeltaPercent: number;
  phaseDeltaCycles: number | null;
  stabilityPercent: number;
  cadenceHistory: CadenceHistorySample[];
}

export interface SyncUpdateInput {
  dtSeconds: number;
  rider1CadenceRpm: number;
  rider2CadenceRpm: number;
  rider1Online: boolean;
  rider2Online: boolean;
  rider1Confidence: number;
  rider2Confidence: number;
  rider1Phase?: number | null;
  rider2Phase?: number | null;
  tempoThreshold?: number;
  phaseThreshold?: number;
  stabilityThreshold?: number;
  confidenceThreshold?: number;
  minCadenceRpm?: number;
  cadenceDeltaRpmThreshold?: number;
  historySeconds?: number;
  fadeSeconds?: number;
  requirePhase?: boolean;
}

export interface CadenceHistorySample {
  elapsedSeconds: number;
  rider1CadenceRpm: number;
  rider2CadenceRpm: number;
}

const BASE_TRACKS: TrackId[] = ["drums", "bass"];
const REWARD_STAGES: Array<{ seconds: number; track: TrackId }> = [
  { seconds: 60, track: "lead" },
  { seconds: 120, track: "piano" },
  { seconds: 180, track: "guitar" },
  { seconds: 240, track: "pad" },
];
const ALL_TRACKS: TrackId[] = ["bass", "lead", "drums", "piano", "guitar", "pad"];

function baseVolumes(): Record<TrackId, number> {
  return {
    bass: 1,
    lead: 0,
    drums: 1,
    piano: 0,
    guitar: 0,
    pad: 0,
  };
}

export function createSyncState(): SyncState {
  return {
    synced: false,
    syncedSeconds: 0,
    unlockedTracks: [...BASE_TRACKS],
    layerVolumes: baseVolumes(),
    nextUnlockSeconds: 60,
    reason: "waiting",
    lastCueTrack: null,
    tempoDeltaPercent: 0,
    phaseDeltaCycles: null,
    stabilityPercent: 0,
    cadenceHistory: [],
  };
}

function tempoDeltaPercent(a: number, b: number): number {
  if (a <= 0 || b <= 0) {
    return 1;
  }
  return Math.abs(a - b) / ((a + b) / 2);
}

function phaseDeltaCycles(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || b === null || a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  const raw = Math.abs(a - b) % 1;
  return Math.min(raw, 1 - raw);
}

function cadenceStability(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) {
    return 1;
  }
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function appendHistory(previous: SyncState, input: SyncUpdateInput, historySeconds: number): CadenceHistorySample[] {
  const previousHistory = previous.cadenceHistory ?? [];
  const lastElapsed = previousHistory.at(-1)?.elapsedSeconds ?? 0;
  const elapsedSeconds = lastElapsed + Math.max(0, input.dtSeconds);
  return [
    ...previousHistory,
    {
      elapsedSeconds,
      rider1CadenceRpm: input.rider1CadenceRpm,
      rider2CadenceRpm: input.rider2CadenceRpm,
    },
  ].filter((sample) => elapsedSeconds - sample.elapsedSeconds <= historySeconds);
}

function nextUnlock(syncedSeconds: number): number | null {
  const next = REWARD_STAGES.find((stage) => syncedSeconds < stage.seconds);
  return next ? Math.max(0, next.seconds - syncedSeconds) : null;
}

function tracksForSyncedSeconds(syncedSeconds: number): TrackId[] {
  const tracks = [...BASE_TRACKS];
  for (const stage of REWARD_STAGES) {
    if (syncedSeconds >= stage.seconds) {
      tracks.push(stage.track);
    }
  }
  return tracks;
}

export function updateSyncState(previous: SyncState, input: SyncUpdateInput): SyncState {
  const tempoThreshold = input.tempoThreshold ?? 0.035;
  const phaseThreshold = input.phaseThreshold ?? 0.18;
  const stabilityThreshold = input.stabilityThreshold ?? 0.08;
  const confidenceThreshold = input.confidenceThreshold ?? 0.6;
  const minCadenceRpm = input.minCadenceRpm ?? 35;
  const cadenceDeltaRpmThreshold = input.cadenceDeltaRpmThreshold ?? 3;
  const historySeconds = input.historySeconds ?? 8;
  const fadeSeconds = input.fadeSeconds ?? 25;
  const requirePhase = input.requirePhase ?? true;
  const history = appendHistory(previous, input, historySeconds);
  const phaseDelta = phaseDeltaCycles(input.rider1Phase, input.rider2Phase);
  const delta = tempoDeltaPercent(input.rider1CadenceRpm, input.rider2CadenceRpm);
  const cadenceDeltaRpm = Math.abs(input.rider1CadenceRpm - input.rider2CadenceRpm);
  const rider1Stability = cadenceStability(history.map((sample) => sample.rider1CadenceRpm));
  const rider2Stability = cadenceStability(history.map((sample) => sample.rider2CadenceRpm));
  const stabilityPercent = Math.max(rider1Stability, rider2Stability);
  const enoughHistory = history.length >= 8;

  const hasTempo = input.rider1CadenceRpm >= minCadenceRpm && input.rider2CadenceRpm >= minCadenceRpm;
  const enoughConfidence = input.rider1Confidence >= confidenceThreshold && input.rider2Confidence >= confidenceThreshold;
  const tempoMatched = delta <= tempoThreshold || cadenceDeltaRpm <= cadenceDeltaRpmThreshold;
  const stable = !enoughHistory || stabilityPercent <= stabilityThreshold;
  const phaseMatched = !requirePhase || (phaseDelta !== null && phaseDelta <= phaseThreshold);
  const synced =
    input.rider1Online &&
    input.rider2Online &&
    hasTempo &&
    enoughConfidence &&
    tempoMatched &&
    stable &&
    phaseMatched;

  if (synced) {
    const syncedSeconds = previous.syncedSeconds + Math.max(0, input.dtSeconds);
    const unlockedTracks = tracksForSyncedSeconds(syncedSeconds);
    const volumes = { ...previous.layerVolumes };
    for (const track of unlockedTracks) {
      volumes[track] = 1;
    }
    for (const track of ALL_TRACKS) {
      if (!unlockedTracks.includes(track)) {
        volumes[track] = 0;
      }
    }

    let lastNewTrack: TrackId | null = null;
    for (let index = unlockedTracks.length - 1; index >= 0; index -= 1) {
      const track = unlockedTracks[index];
      if (!previous.unlockedTracks.includes(track)) {
        lastNewTrack = track;
        break;
      }
    }

    return {
      synced: true,
      syncedSeconds,
      unlockedTracks,
      layerVolumes: volumes,
      nextUnlockSeconds: nextUnlock(syncedSeconds),
      reason: "synced",
      lastCueTrack: lastNewTrack,
      tempoDeltaPercent: delta,
      phaseDeltaCycles: phaseDelta,
      stabilityPercent,
      cadenceHistory: history,
    };
  }

  const fadeAmount = Math.max(0, input.dtSeconds) / fadeSeconds;
  const volumes = { ...previous.layerVolumes, drums: 1, bass: 1 };
  for (const track of REWARD_STAGES.map((stage) => stage.track)) {
    volumes[track] = Math.max(0, volumes[track] - fadeAmount);
  }

  const unlockedTracks = ALL_TRACKS.filter((track) => volumes[track] > 0.01);
  if (!unlockedTracks.includes("drums")) {
    unlockedTracks.unshift("drums");
  }
  if (!unlockedTracks.includes("bass")) {
    unlockedTracks.splice(1, 0, "bass");
  }

  let reason = "not synced";
  if (!input.rider1Online || !input.rider2Online) {
    reason = "传感器离线";
  } else if (!enoughConfidence) {
    reason = "数据不稳";
  } else if (!hasTempo) {
    reason = "踏频太低";
  } else if (enoughHistory && !stable) {
    reason = "节奏不稳定";
  } else if (!tempoMatched) {
    reason = "速度差太大";
  } else if (requirePhase && phaseDelta === null) {
    reason = "等待节拍";
  } else if (!phaseMatched) {
    reason = "节拍没对齐";
  }

  return {
    synced: false,
    syncedSeconds: previous.syncedSeconds,
    unlockedTracks,
    layerVolumes: volumes,
    nextUnlockSeconds: nextUnlock(previous.syncedSeconds),
    reason,
    lastCueTrack: null,
    tempoDeltaPercent: delta,
    phaseDeltaCycles: phaseDelta,
    stabilityPercent,
    cadenceHistory: history,
  };
}
