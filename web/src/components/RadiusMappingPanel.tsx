import { SlidersHorizontal } from "lucide-react";
import type { RadiusMappingPayload } from "../api/gatewayClient";
import { cadenceRpmToRadius } from "../core/radiusMapping";

interface RadiusMappingPanelProps {
  mapping: RadiusMappingPayload;
  user1CadenceRpm: number;
  user2CadenceRpm: number;
  onChange: (mapping: RadiusMappingPayload) => void;
}

export function RadiusMappingPanel({ mapping, user1CadenceRpm, user2CadenceRpm, onChange }: RadiusMappingPanelProps) {
  const update = (key: keyof RadiusMappingPayload, value: number) => {
    onChange({ ...mapping, [key]: value });
  };

  return (
    <section className="panel radius-mapping-panel">
      <div className="panel-title">
        <SlidersHorizontal size={18} />
        <span>M5Stack 球半径映射</span>
        <strong>{mapping.minRpm}-{mapping.maxRpm} rpm</strong>
      </div>
      <div className="mapping-grid">
        <label>
          <span>最小 RPM</span>
          <input type="number" step={1} value={mapping.minRpm} onChange={(event) => update("minRpm", Number(event.target.value))} />
        </label>
        <label>
          <span>最大 RPM</span>
          <input type="number" step={1} value={mapping.maxRpm} onChange={(event) => update("maxRpm", Number(event.target.value))} />
        </label>
        <label>
          <span>最小半径</span>
          <input type="number" step={1} value={mapping.minRadius} onChange={(event) => update("minRadius", Number(event.target.value))} />
        </label>
        <label>
          <span>最大半径</span>
          <input type="number" step={1} value={mapping.maxRadius} onChange={(event) => update("maxRadius", Number(event.target.value))} />
        </label>
      </div>
      <div className="mapping-preview">
        <span>用户 1 → {cadenceRpmToRadius(user1CadenceRpm, mapping)} px</span>
        <span>用户 2 → {cadenceRpmToRadius(user2CadenceRpm, mapping)} px</span>
      </div>
    </section>
  );
}
