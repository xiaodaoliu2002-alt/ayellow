import { describe, expect, it } from "vitest";
import { mapCadenceToPlayback } from "./cadenceMapping";

describe("mapCadenceToPlayback", () => {
  it("keeps comfortable cadence at normal playback speed", () => {
    const mapped = mapCadenceToPlayback({ cadenceRpm: 80, baselineCadenceRpm: 80 });

    expect(mapped.valid).toBe(true);
    expect(mapped.speedRatio).toBe(1);
    expect(mapped.cadenceRatio).toBe(1);
  });

  it("turns cadence changes into clearly audible speed changes", () => {
    const slow = mapCadenceToPlayback({ cadenceRpm: 60, baselineCadenceRpm: 80 });
    const fast = mapCadenceToPlayback({ cadenceRpm: 100, baselineCadenceRpm: 80 });

    expect(slow.speedRatio).toBe(0.8);
    expect(fast.speedRatio).toBe(1.2);
  });

  it("keeps extreme motion inside usable time-stretch bounds", () => {
    expect(mapCadenceToPlayback({ cadenceRpm: 20, baselineCadenceRpm: 80 }).speedRatio).toBe(0.55);
    expect(mapCadenceToPlayback({ cadenceRpm: 160, baselineCadenceRpm: 80 }).speedRatio).toBe(1.65);
  });

  it("can scale hand-shaken cadence into a cycling range", () => {
    const mapped = mapCadenceToPlayback({ cadenceRpm: 25, baselineCadenceRpm: 80, cadenceMultiplier: 3 });

    expect(mapped.effectiveCadenceRpm).toBe(75);
    expect(mapped.speedRatio).toBeCloseTo(0.95);
  });

  it("can exaggerate playback speed changes", () => {
    const normal = mapCadenceToPlayback({ cadenceRpm: 100, baselineCadenceRpm: 80 });
    const exaggerated = mapCadenceToPlayback({ cadenceRpm: 100, baselineCadenceRpm: 80, speedIntensity: 1.5 });

    expect(exaggerated.speedRatio).toBeGreaterThan(normal.speedRatio);
  });

  it("falls back to normal speed when cadence is not usable", () => {
    expect(mapCadenceToPlayback({ cadenceRpm: 0, baselineCadenceRpm: 80 })).toMatchObject({ valid: false, speedRatio: 1 });
    expect(mapCadenceToPlayback({ cadenceRpm: 80, baselineCadenceRpm: 0 })).toMatchObject({ valid: false, speedRatio: 1 });
  });
});
