import type { SongConfig, StemTrackId } from "../music/songCatalog";

export type ChallengeStage = 1 | 2 | 3 | 4;
export type ChallengeCueKind = "unlock" | "speedUp" | "slowDown" | "success";
export type ChallengeRiderId = "user1" | "user2";

export interface ChallengeCue {
  kind: ChallengeCueKind;
}

export interface ChallengeState {
  stage: ChallengeStage;
  progressSeconds: number;
  stageSeconds: number;
  preStageSecondsRemaining: number;
  preStageCadenceTotals: Record<ChallengeRiderId, number>;
  preStageSampleSeconds: number;
  drumController: ChallengeRiderId | null;
  holdSecondsRemaining: number;
  activeTracks: StemTrackId[];
  layerVolumes: Record<StemTrackId, number>;
  cue: ChallengeCue | null;
}

export interface ChallengeUpdateInput {
  dtSeconds: number;
  synced: boolean;
  rider1Active: boolean;
  rider2Active: boolean;
  song: SongConfig;
  rider1CadenceRpm?: number;
  rider2CadenceRpm?: number;
  stageSeconds?: number;
  preStageSeconds?: number;
  holdSeconds?: number;
  regressRate?: number;
}

const TRACKS: StemTrackId[] = ["drums", "guitar", "bass", "other", "vocals"];

function tracksForStage(song: SongConfig, stage: ChallengeStage): StemTrackId[] {
  const tracks = [...song.baseTracks];
  if (stage >= 2) {
    tracks.push(song.rewardTracks[0]);
  }
  if (stage >= 3) {
    tracks.push(song.rewardTracks[1]);
  }
  if (stage >= 4) {
    tracks.push(song.rewardTracks[2]);
  }
  return tracks;
}

function volumesForTracks(
  activeTracks: StemTrackId[],
  song: SongConfig,
  rider1Active: boolean,
  rider2Active: boolean,
  drumController: ChallengeRiderId | null,
): Record<StemTrackId, number> {
  const ridersActive = rider1Active && rider2Active;
  const guitarController = drumController === "user2" ? "user1" : "user2";
  return Object.fromEntries(TRACKS.map((track) => {
    const isDrumTrack = track === song.baseTracks[0];
    const isGuitarTrack = track === song.baseTracks[1];
    const isRewardTrack = song.rewardTracks.includes(track);
    const audible =
      activeTracks.includes(track) &&
      ((isDrumTrack && (drumController === "user1" ? rider1Active : rider2Active)) ||
        (isGuitarTrack && (guitarController === "user1" ? rider1Active : rider2Active)) ||
        (isRewardTrack && ridersActive));
    return [track, audible ? 1 : 0];
  })) as Record<
    StemTrackId,
    number
  >;
}

export function createChallengeState(song: SongConfig, stageSeconds = 30, preStageSeconds = 15): ChallengeState {
  const activeTracks = tracksForStage(song, 1);
  return {
    stage: 1,
    progressSeconds: 0,
    stageSeconds,
    preStageSecondsRemaining: preStageSeconds,
    preStageCadenceTotals: { user1: 0, user2: 0 },
    preStageSampleSeconds: 0,
    drumController: null,
    holdSecondsRemaining: 0,
    activeTracks,
    layerVolumes: volumesForTracks(activeTracks, song, false, false, null),
    cue: null,
  };
}

function nextStage(stage: ChallengeStage): ChallengeStage {
  return Math.min(4, stage + 1) as ChallengeStage;
}

function cueForStage(stage: ChallengeStage): ChallengeCue | null {
  if (stage === 2) {
    return { kind: "speedUp" };
  }
  if (stage === 3) {
    return { kind: "slowDown" };
  }
  if (stage === 4) {
    return { kind: "success" };
  }
  return null;
}

function resolveDrumController(totals: Record<ChallengeRiderId, number>): ChallengeRiderId {
  return totals.user2 > totals.user1 ? "user2" : "user1";
}

export function updateChallengeState(previous: ChallengeState, input: ChallengeUpdateInput): ChallengeState {
  const stageSeconds = input.stageSeconds ?? previous.stageSeconds;
  const holdSeconds = input.holdSeconds ?? 8;
  const dtSeconds = Math.max(0, input.dtSeconds);
  const ridersActive = input.rider1Active && input.rider2Active;

  if (previous.preStageSecondsRemaining > 0) {
    const sampleSeconds = Math.min(dtSeconds, previous.preStageSecondsRemaining);
    const preStageCadenceTotals = {
      user1: previous.preStageCadenceTotals.user1 + Math.max(0, input.rider1CadenceRpm ?? 0) * sampleSeconds,
      user2: previous.preStageCadenceTotals.user2 + Math.max(0, input.rider2CadenceRpm ?? 0) * sampleSeconds,
    };
    const preStageSecondsRemaining = Math.max(0, previous.preStageSecondsRemaining - dtSeconds);
    const drumController = preStageSecondsRemaining === 0 ? resolveDrumController(preStageCadenceTotals) : null;
    const activeTracks = tracksForStage(input.song, previous.stage);
    return {
      ...previous,
      stageSeconds,
      preStageSecondsRemaining,
      preStageCadenceTotals,
      preStageSampleSeconds: previous.preStageSampleSeconds + sampleSeconds,
      drumController,
      progressSeconds: 0,
      activeTracks,
      layerVolumes: volumesForTracks(activeTracks, input.song, input.rider1Active, input.rider2Active, drumController),
      cue: null,
    };
  }

  const drumController = previous.drumController ?? "user1";

  if (previous.stage === 4) {
    const activeTracks = tracksForStage(input.song, 4);
    return {
      ...previous,
      activeTracks,
      progressSeconds: stageSeconds,
      holdSecondsRemaining: 0,
      layerVolumes: volumesForTracks(activeTracks, input.song, input.rider1Active, input.rider2Active, drumController),
      cue: null,
    };
  }

  if (previous.holdSecondsRemaining > 0) {
    const holdSecondsRemaining = Math.max(0, previous.holdSecondsRemaining - dtSeconds);
    const activeTracks = tracksForStage(input.song, previous.stage);
    return {
      ...previous,
      activeTracks,
      holdSecondsRemaining,
      progressSeconds: 0,
      layerVolumes: volumesForTracks(activeTracks, input.song, input.rider1Active, input.rider2Active, drumController),
      cue: holdSecondsRemaining === 0 ? cueForStage(previous.stage) : null,
    };
  }

  const nextProgress = input.synced && ridersActive
    ? previous.progressSeconds + dtSeconds
    : Math.max(0, previous.progressSeconds - dtSeconds * (input.regressRate ?? 1));

  if (nextProgress >= stageSeconds) {
    const stage = nextStage(previous.stage);
    const activeTracks = tracksForStage(input.song, stage);
    const holdSecondsRemaining = stage === 2 || stage === 3 ? holdSeconds : 0;
    return {
      ...previous,
      stage,
      progressSeconds: stage === 4 ? stageSeconds : 0,
      stageSeconds,
      drumController,
      holdSecondsRemaining,
      activeTracks,
      layerVolumes: volumesForTracks(activeTracks, input.song, input.rider1Active, input.rider2Active, drumController),
      cue: holdSecondsRemaining > 0 ? { kind: "unlock" } : cueForStage(stage),
    };
  }

  const activeTracks = tracksForStage(input.song, previous.stage);
  return {
    ...previous,
    progressSeconds: nextProgress,
    stageSeconds,
    holdSecondsRemaining: 0,
    activeTracks,
    layerVolumes: volumesForTracks(activeTracks, input.song, input.rider1Active, input.rider2Active, drumController),
    cue: null,
  };
}
