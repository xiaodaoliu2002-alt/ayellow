import type { M5StackAnimationUpdate } from "./m5stackAnimationSignal";

export function startCountdownAnimationUpdate(countdownRemainingSeconds: number): M5StackAnimationUpdate {
  return {
    stage: 1,
    progress: 0,
    countdownRemainingSeconds,
    stage4Video: "idle",
  };
}
