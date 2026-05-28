import type { ChallengeState } from "./challengeState";

export type M5StackPlaybackState = "playing" | "idle";

export interface M5StackAnimationUpdate {
  stage: ChallengeState["stage"];
  progress: number;
  congratulations?: M5StackPlaybackState;
  stage4Video?: M5StackPlaybackState;
  countdownRemainingSeconds?: number;
}

export function stageProgressRatio(state: ChallengeState): number {
  if (state.stage === 4) {
    return 1;
  }
  if (state.stageSeconds <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, state.progressSeconds / state.stageSeconds));
}

export function m5stackAnimationUpdate(previous: ChallengeState, next: ChallengeState): M5StackAnimationUpdate {
  const update: M5StackAnimationUpdate = {
    stage: next.stage,
    progress: stageProgressRatio(next),
    stage4Video: next.stage === 4 ? "playing" : "idle",
  };

  if (next.stage > previous.stage) {
    update.congratulations = "playing";
  }

  return update;
}
