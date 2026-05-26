export interface CadenceMappingInput {
  cadenceRpm: number;
  baselineCadenceRpm: number;
  songBaseBpm: number;
  minRatio?: number;
  maxRatio?: number;
}

const roundBpm = (value: number) => Math.round(value * 1000) / 1000;
const roundRatio = (value: number) => Math.round(value * 1000) / 1000;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mapCadenceToBpm({
  cadenceRpm,
  baselineCadenceRpm,
  songBaseBpm,
  minRatio = 0.75,
  maxRatio = 1.25,
}: CadenceMappingInput): number {
  if (cadenceRpm <= 0 || baselineCadenceRpm <= 0 || songBaseBpm <= 0) {
    return 0;
  }

  return roundBpm(songBaseBpm * clamp(cadenceRpm / baselineCadenceRpm, minRatio, maxRatio));
}

export interface CadencePlaybackInput {
  cadenceRpm: number;
  baselineCadenceRpm: number;
  cadenceMultiplier?: number;
  minSpeedRatio?: number;
  maxSpeedRatio?: number;
  sensitivity?: number;
  speedIntensity?: number;
}

export interface CadencePlaybackMapping {
  valid: boolean;
  cadenceRatio: number;
  effectiveCadenceRpm: number;
  speedRatio: number;
  intensity: number;
}

export function mapCadenceToPlayback({
  cadenceRpm,
  baselineCadenceRpm,
  cadenceMultiplier = 1,
  minSpeedRatio = 0.55,
  maxSpeedRatio = 1.65,
  sensitivity = 0.8,
  speedIntensity = 1,
}: CadencePlaybackInput): CadencePlaybackMapping {
  const effectiveCadenceRpm = cadenceRpm * Math.max(0, cadenceMultiplier);
  if (effectiveCadenceRpm <= 0 || baselineCadenceRpm <= 0) {
    return {
      valid: false,
      cadenceRatio: 0,
      effectiveCadenceRpm: 0,
      speedRatio: 1,
      intensity: 0,
    };
  }

  const cadenceRatio = effectiveCadenceRpm / baselineCadenceRpm;
  const speedRatio = clamp(1 + (cadenceRatio - 1) * sensitivity * speedIntensity, minSpeedRatio, maxSpeedRatio);
  const intensity = clamp((speedRatio - minSpeedRatio) / (maxSpeedRatio - minSpeedRatio), 0, 1);

  return {
    valid: true,
    cadenceRatio: roundRatio(cadenceRatio),
    effectiveCadenceRpm: roundRatio(effectiveCadenceRpm),
    speedRatio: roundRatio(speedRatio),
    intensity: roundRatio(intensity),
  };
}
