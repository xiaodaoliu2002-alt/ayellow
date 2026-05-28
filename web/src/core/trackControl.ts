import type { TrackSpeeds } from "../audio/types";
import type { ChallengeRiderId, ChallengeStage } from "./challengeState";

export function trackSpeedsForRiders(
  stage: ChallengeStage,
  drumController: ChallengeRiderId | null,
  rider1Speed: number,
  rider2Speed: number,
): TrackSpeeds {
  if (stage === 4) {
    return { drums: 1, guitar: 1, bass: 1, other: 1, vocals: 1 };
  }

  const drumSpeed = drumController === "user2" ? rider2Speed : rider1Speed;
  const guitarSpeed = drumController === "user2" ? rider1Speed : rider2Speed;
  return {
    drums: drumSpeed,
    guitar: guitarSpeed,
    bass: drumSpeed,
    other: drumSpeed,
    vocals: drumSpeed,
  };
}
