import { Pause, Play, RadioTower } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GatewayClient, type Axis, type GatewayPayload, type RiderConfigPayload, type RiderId } from "./api/gatewayClient";
import { AudioEngine } from "./audio/engine";
import type { TrackSpeeds } from "./audio/types";
import { RiderPanel } from "./components/RiderPanel";
import { SyncPanel } from "./components/SyncPanel";
import { TrackLayers } from "./components/TrackLayers";
import { mapCadenceToPlayback } from "./core/cadenceMapping";
import { createSyncState, updateSyncState, type SyncState } from "./core/syncState";
import type { TrackId } from "./music/types";

const defaultRider = (id: RiderId): GatewayPayload["riders"][RiderId] => ({
  id,
  sensorIp: "",
  frontTeeth: 42,
  rearTeeth: 16,
  axis: "z",
  baselineCadenceRpm: 80,
  wheelRpm: 0,
  rhythmPhase: null,
  cadenceRpm: 0,
  rawCadenceRpm: 0,
  status: "waiting",
  online: false,
  confidence: 0,
  lastSeen: null,
});

const defaultGatewayState: GatewayPayload = {
  type: "state",
  timestamp: 0,
  riders: {
    user1: defaultRider("user1"),
    user2: defaultRider("user2"),
  },
  discoveredSensors: [],
};

const defaultConfig: Record<RiderId, RiderConfigPayload> = {
  user1: { sensorIp: "", frontTeeth: 42, rearTeeth: 16, axis: "z" },
  user2: { sensorIp: "", frontTeeth: 42, rearTeeth: 16, axis: "z" },
};

const TRACKS: TrackId[] = ["bass", "lead", "drums", "piano", "guitar", "pad"];
type SyncMode = "experiment" | "ride";

export function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  const clientRef = useRef<GatewayClient | null>(null);
  const gatewayRef = useRef<GatewayPayload>(defaultGatewayState);
  const syncRef = useRef<SyncState>(createSyncState());
  const [gatewayState, setGatewayState] = useState<GatewayPayload>(defaultGatewayState);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "offline">("offline");
  const [riderConfig, setRiderConfig] = useState(defaultConfig);
  const [audioRunning, setAudioRunning] = useState(false);
  const [sync, setSync] = useState<SyncState>(() => createSyncState());
  const [cadenceMultiplier, setCadenceMultiplier] = useState(3);
  const [speedIntensity, setSpeedIntensity] = useState(1.35);
  const [syncWindow, setSyncWindow] = useState(10);
  const [syncMode, setSyncMode] = useState<SyncMode>("experiment");
  const experimentMode = syncMode === "experiment";

  const rider1Playback = mapCadenceToPlayback({
    cadenceRpm: gatewayState.riders.user1.cadenceRpm,
    baselineCadenceRpm: gatewayState.riders.user1.baselineCadenceRpm,
    cadenceMultiplier,
    speedIntensity,
  });
  const rider2Playback = mapCadenceToPlayback({
    cadenceRpm: gatewayState.riders.user2.cadenceRpm,
    baselineCadenceRpm: gatewayState.riders.user2.baselineCadenceRpm,
    cadenceMultiplier,
    speedIntensity,
  });
  const rewardSpeed =
    rider1Playback.valid && rider2Playback.valid ? (rider1Playback.speedRatio + rider2Playback.speedRatio) / 2 : 1;

  useEffect(() => {
    const client = new GatewayClient("ws://127.0.0.1:8765", setGatewayState, setConnectionStatus);
    client.connect();
    clientRef.current = client;
    return () => client.close();
  }, []);

  useEffect(() => {
    gatewayRef.current = gatewayState;
  }, [gatewayState]);

  useEffect(() => {
    clientRef.current?.sendConfig(riderConfig);
  }, [riderConfig]);

  useEffect(() => {
    const reset = createSyncState();
    syncRef.current = reset;
    setSync(reset);
    engineRef.current?.setLayerVolumes(reset.layerVolumes);
  }, [syncMode]);

  useEffect(() => {
    if (!audioRunning) {
      return;
    }
    const timer = window.setInterval(() => {
      const current = gatewayRef.current;
      const previousSync = syncRef.current;
      const rider1CadenceForSync = experimentMode
        ? current.riders.user1.cadenceRpm * cadenceMultiplier
        : current.riders.user1.cadenceRpm;
      const rider2CadenceForSync = experimentMode
        ? current.riders.user2.cadenceRpm * cadenceMultiplier
        : current.riders.user2.cadenceRpm;
      const next = updateSyncState(syncRef.current, {
        dtSeconds: 0.25,
        rider1CadenceRpm: rider1CadenceForSync,
        rider2CadenceRpm: rider2CadenceForSync,
        rider1Online: current.riders.user1.online,
        rider2Online: current.riders.user2.online,
        rider1Confidence: current.riders.user1.confidence,
        rider2Confidence: current.riders.user2.confidence,
        rider1Phase: current.riders.user1.rhythmPhase,
        rider2Phase: current.riders.user2.rhythmPhase,
        cadenceDeltaRpmThreshold: syncWindow,
        tempoThreshold: syncWindow / 100,
        phaseThreshold: Math.min(0.35, 0.08 + syncWindow / 70),
        stabilityThreshold: experimentMode ? Math.min(0.35, 0.08 + syncWindow / 55) : Math.min(0.22, 0.04 + syncWindow / 80),
        confidenceThreshold: experimentMode ? 0.2 : 0.6,
        minCadenceRpm: experimentMode ? 10 : 35,
        historySeconds: experimentMode ? 4 : 8,
        requirePhase: !experimentMode,
      });
      syncRef.current = next;
      setSync(next);
      if (next.synced && (!previousSync.synced || next.lastCueTrack)) {
        engineRef.current?.syncToStem("bass");
      }
      if (next.lastCueTrack) {
        engineRef.current?.cue();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [audioRunning, cadenceMultiplier, experimentMode, syncWindow]);

  useEffect(() => {
    if (!audioRunning) {
      return;
    }
    const speeds: TrackSpeeds = {
      drums: rider1Playback.valid ? rider1Playback.speedRatio : 1,
      bass: rider2Playback.valid ? rider2Playback.speedRatio : 1,
      lead: rewardSpeed,
      piano: rewardSpeed,
      guitar: rewardSpeed,
      pad: rewardSpeed,
    };
    engineRef.current?.setTrackSpeeds(speeds);
    engineRef.current?.setLayerVolumes(sync.layerVolumes);
  }, [audioRunning, rider1Playback, rider2Playback, rewardSpeed, sync.layerVolumes]);

  const setConfig = (id: RiderId, next: RiderConfigPayload) => {
    setRiderConfig((current) => ({ ...current, [id]: next }));
  };

  const assignDiscovered = (id: RiderId, ip: string) => {
    setRiderConfig((current) => ({ ...current, [id]: { ...current[id], sensorIp: ip } }));
  };

  const startAudio = async () => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    await engineRef.current.start();
    engineRef.current.setLayerVolumes(sync.layerVolumes);
    setAudioRunning(true);
  };

  const stopAudio = () => {
    engineRef.current?.stop();
    setAudioRunning(false);
  };

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Good Time Stem Rider</p>
          <h1>双人骑行音乐控制台</h1>
        </div>
        <div className="header-actions">
          <div className={`connection ${connectionStatus}`}>
            <RadioTower size={16} />
            <span>{connectionStatus === "connected" ? "网关在线" : connectionStatus === "connecting" ? "连接中" : "网关离线"}</span>
          </div>
          <button className="primary" onClick={audioRunning ? stopAudio : startAudio}>
            {audioRunning ? <Pause size={18} /> : <Play size={18} />}
            <span>{audioRunning ? "停止" : "开始"}</span>
          </button>
        </div>
      </header>

      <section className="dashboard">
        <RiderPanel
          id="user1"
          label="用户 1"
          trackName="Drums"
          rider={gatewayState.riders.user1}
          speedRatio={rider1Playback.speedRatio}
          effectiveCadenceRpm={rider1Playback.effectiveCadenceRpm}
          config={riderConfig.user1}
          onConfigChange={(next) => setConfig("user1", next)}
        />
        <SyncPanel sync={sync} />
        <RiderPanel
          id="user2"
          label="用户 2"
          trackName="Bass"
          rider={gatewayState.riders.user2}
          speedRatio={rider2Playback.speedRatio}
          effectiveCadenceRpm={rider2Playback.effectiveCadenceRpm}
          config={riderConfig.user2}
          onConfigChange={(next) => setConfig("user2", next)}
        />
      </section>

      <section className="lower-grid">
        <TrackLayers sync={sync} />
        <section className="panel control-panel">
          <div className="panel-title">
            <RadioTower size={18} />
            <span>实验控制</span>
            <strong>手动调节</strong>
          </div>
          <label className="range-row">
            <span>同步模式</span>
            <div className="mode-toggle" role="group" aria-label="同步模式">
              <button className={syncMode === "experiment" ? "selected" : ""} onClick={() => setSyncMode("experiment")}>
                实验
              </button>
              <button className={syncMode === "ride" ? "selected" : ""} onClick={() => setSyncMode("ride")}>
                骑行
              </button>
            </div>
            <strong>{experimentMode ? "宽松" : "严格"}</strong>
          </label>
          <label className="range-row">
            <span>踏频倍率</span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={cadenceMultiplier}
              onChange={(event) => setCadenceMultiplier(Number(event.target.value))}
            />
            <strong>{cadenceMultiplier.toFixed(1)}x</strong>
          </label>
          <label className="range-row">
            <span>变速强度</span>
            <input
              type="range"
              min={0.6}
              max={2.2}
              step={0.05}
              value={speedIntensity}
              onChange={(event) => setSpeedIntensity(Number(event.target.value))}
            />
            <strong>{speedIntensity.toFixed(2)}x</strong>
          </label>
          <label className="range-row">
            <span>同步区间</span>
            <input
              type="range"
              min={3}
              max={18}
              step={1}
              value={syncWindow}
              onChange={(event) => setSyncWindow(Number(event.target.value))}
            />
            <strong>{syncWindow} rpm</strong>
          </label>
        </section>
      </section>

      <section className="lower-grid single">
        <section className="panel discovered-panel">
          <div className="panel-title">
            <RadioTower size={18} />
            <span>未绑定传感器</span>
            <strong>{gatewayState.discoveredSensors.length}</strong>
          </div>
          <div className="sensor-list">
            {gatewayState.discoveredSensors.length === 0 ? (
              <div className="empty">等待数据</div>
            ) : (
              gatewayState.discoveredSensors.map((sensor) => (
                <div className="sensor-row" key={sensor.ip}>
                  <span>{sensor.ip}</span>
                  <small>{sensor.deviceId ?? `:${sensor.port}`}</small>
                  <button onClick={() => assignDiscovered("user1", sensor.ip)}>用户 1</button>
                  <button onClick={() => assignDiscovered("user2", sensor.ip)}>用户 2</button>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
