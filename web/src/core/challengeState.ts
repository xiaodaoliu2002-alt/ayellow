import type { SongConfig, StemTrackId } from "../music/songCatalog";

export type ChallengeStage = 1 | 2 | 3 | 4;
export type ChallengeCueKind = "speedUp" | "slowDown" | "success";

export interface ChallengeCue {
  kind: ChallengeCueKind;
}

export interface ChallengeState {
  stage: ChallengeStage;
  progressSeconds: number;
  stageSeconds: number;
  activeTracks: StemTrackId[];
  layerVolumes: Record<StemTrackId, number>;
  cue: ChallengeCue | null;
}

export interface ChallengeUpdateInput {
  dtSeconds: number;
  synced: boolean;
  ridersActive: boolean;
  song: SongConfig;
  stageSeconds?: number;
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

function volumesForTracks(activeTracks: StemTrackId[], ridersActive: boolean): Record<StemTrackId, number> {
  return Object.fromEntries(TRACKS.map((track) => [track, ridersActive && activeTracks.includes(track) ? 1 : 0])) as Record<
    StemTrackId,
    number
  >;
}

export function createChallengeState(song: SongConfig, stageSeconds = 30): ChallengeState {
  const activeTracks = tracksForStage(song, 1);
  return {
    stage: 1,
    progressSeconds: 0,
    stageSeconds,
    activeTracks,
    layerVolumes: volumesForTracks(activeTracks, false),
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

export function updateChallengeState(previous: ChallengeState, input: ChallengeUpdateInput): ChallengeState {
  const stageSeconds = input.stageSeconds ?? previous.stageSeconds;
  const dtSeconds = Math.max(0, input.dtSeconds);

  if (previous.stage === 4) {
    const activeTracks = tracksForStage(input.song, 4);
    return {
      ...previous,
      activeTracks,
      progressSeconds: stageSeconds,
      layerVolumes: volumesForTracks(activeTracks, input.ridersActive),
      cue: null,
    };
  }

  const nextProgress = input.synced && input.ridersActive
    ? previous.progressSeconds + dtSeconds
    : Math.max(0, previous.progressSeconds - dtSeconds * (input.regressRate ?? 1));

  if (nextProgress >= stageSeconds) {
    const stage = nextStage(previous.stage);
    const activeTracks = tracksForStage(input.song, stage);
    return {
      stage,
      progressSeconds: stage === 4 ? stageSeconds : 0,
      stageSeconds,
      activeTracks,
      layerVolumes: volumesForTracks(activeTracks, input.ridersActive),
      cue: cueForStage(stage),
    };
  }

  const activeTracks = tracksForStage(input.song, previous.stage);
  return {
    ...previous,
    progressSeconds: nextProgress,
    stageSeconds,
    activeTracks,
    layerVolumes: volumesForTracks(activeTracks, input.ridersActive),
    cue: null,
  };
}
