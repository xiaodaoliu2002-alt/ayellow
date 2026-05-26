import { Activity, Bike, Radio, SlidersHorizontal } from "lucide-react";
import type { Axis, RiderConfigPayload, RiderId, RiderPayload } from "../api/gatewayClient";

interface RiderPanelProps {
  id: RiderId;
  label: string;
  trackName: string;
  rider: RiderPayload;
  speedRatio: number;
  effectiveCadenceRpm: number;
  config: RiderConfigPayload;
  onConfigChange: (next: RiderConfigPayload) => void;
}

const AXES: Axis[] = ["x", "y", "z"];

export function RiderPanel({ label, trackName, rider, speedRatio, effectiveCadenceRpm, config, onConfigChange }: RiderPanelProps) {
  const update = <K extends keyof RiderConfigPayload>(key: K, value: RiderConfigPayload[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <section className="panel rider-panel">
      <div className="panel-title">
        <Bike size={18} />
        <span>{label}</span>
        <strong>{trackName}</strong>
      </div>

      <div className="status-row">
        <span className={`dot ${rider.online ? "online" : "offline"}`} />
        <span>{rider.online ? "在线" : rider.status === "stale" ? "掉线" : "等待"}</span>
        <span className="muted">{rider.sensorIp || "未绑定"}</span>
      </div>

      <label>
        <Radio size={15} />
        <span>IP</span>
        <input value={config.sensorIp} onChange={(event) => update("sensorIp", event.target.value)} placeholder="192.168.1.10" />
      </label>

      <div className="gear-grid">
        <label>
          <SlidersHorizontal size={15} />
          <span>前盘</span>
          <input
            type="number"
            min={1}
            value={config.frontTeeth}
            onChange={(event) => update("frontTeeth", Number(event.target.value))}
          />
        </label>
        <label>
          <SlidersHorizontal size={15} />
          <span>后飞</span>
          <input
            type="number"
            min={1}
            value={config.rearTeeth}
            onChange={(event) => update("rearTeeth", Number(event.target.value))}
          />
        </label>
      </div>

      <div className="axis-row" role="group" aria-label={`${label} axis`}>
        {AXES.map((axis) => (
          <button key={axis} className={config.axis === axis ? "selected" : ""} onClick={() => update("axis", axis)}>
            {axis.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="metrics">
        <div>
          <span>踏频</span>
          <strong>{rider.online ? rider.cadenceRpm.toFixed(1) : "--"}</strong>
          <small>rpm</small>
        </div>
        <div>
          <span>模拟</span>
          <strong>{rider.online ? effectiveCadenceRpm.toFixed(1) : "--"}</strong>
          <small>rpm</small>
        </div>
        <div>
          <span>变速</span>
          <strong>{rider.online ? speedRatio.toFixed(2) : "--"}</strong>
          <small>x</small>
        </div>
      </div>

      <div className="mini-line">
        <Activity size={15} />
        <span>轮速 {rider.online ? rider.wheelRpm.toFixed(1) : "--"} rpm</span>
      </div>
    </section>
  );
}
