import type { ChallengeCueKind } from "../core/challengeState";

export interface GuideBpmSettings {
  speedUp: number;
  slowDown: number;
}

const CUE_ASSETS: Record<ChallengeCueKind, string> = {
  unlock: "/audio/cues/提示音1.mp3",
  speedUp: "/audio/cues/加速.mp3",
  slowDown: "/audio/cues/减速.mp3",
  success: "/audio/cues/挑战成功.mp3",
};

export function cueAssetForKind(kind: ChallengeCueKind): string {
  return CUE_ASSETS[kind];
}

export function guideBpmForKind(kind: ChallengeCueKind, settings: GuideBpmSettings): number | null {
  if (kind === "speedUp") {
    return settings.speedUp;
  }
  if (kind === "slowDown") {
    return settings.slowDown;
  }
  return null;
}
