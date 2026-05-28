import { describe, expect, it } from "vitest";
import { cadenceRpmToRadius, defaultRadiusMapping } from "./radiusMapping";

describe("radiusMapping", () => {
  it("maps configurable rpm range to configurable radius range", () => {
    const mapping = { minRpm: 0, maxRpm: 20, minRadius: 10, maxRadius: 40 };

    expect(cadenceRpmToRadius(0, mapping)).toBe(10);
    expect(cadenceRpmToRadius(10, mapping)).toBe(25);
    expect(cadenceRpmToRadius(20, mapping)).toBe(40);
  });

  it("keeps the current default 0-15rpm to 11-33 radius mapping", () => {
    expect(cadenceRpmToRadius(15, defaultRadiusMapping)).toBe(33);
  });
});
