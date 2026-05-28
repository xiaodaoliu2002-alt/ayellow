export interface RadiusMapping {
  minRpm: number;
  maxRpm: number;
  minRadius: number;
  maxRadius: number;
}

export const defaultRadiusMapping: RadiusMapping = {
  minRpm: 0,
  maxRpm: 15,
  minRadius: 11,
  maxRadius: 33,
};

export function cadenceRpmToRadius(cadenceRpm: number, mapping: RadiusMapping): number {
  const rpmSpan = Math.max(1, mapping.maxRpm - mapping.minRpm);
  const t = Math.max(0, Math.min(1, (cadenceRpm - mapping.minRpm) / rpmSpan));
  return Math.round(mapping.minRadius + t * (mapping.maxRadius - mapping.minRadius));
}
