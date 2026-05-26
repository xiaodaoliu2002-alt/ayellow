import { Pause, Play, RadioTower } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GatewayClient, type Axis, type GatewayPayload, type RiderConfigPayload, type RiderId } from "./api/gatewayClient";
import { AudioEngine } from "./audio/engine";
import type { TrackSpeeds } from "./audio/types";
import { RiderPanel } from "./components/RiderPanel";
import { SyncPanel } from "./components/SyncPanel";
import { TrackLayers } from "./components/TrackLayers";
import { createChallengeState, updateChallengeState, type ChallengeState } from "./core/challengeState";
import { mapCadenceToPlayback } from "./core/cadenceMapping";
import { createSyncState, updateSyncState, type SyncState } from "./core/syncState";
import { findSong, SONGS, type SongId } from "./music/songCatalog";

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

type SyncMode = "experiment" | "ride";
const RIDE_START_CADENCE_RPM = 30;
const defaultSong = findSong("magic-potion");

export function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  const clientRef = useRef<GatewayClient | null>(null);
  const gatewayRef = useRef<GatewayPayload>(defaultGatewayState);
  const syncRef = useRef<SyncState>(createSyncState());
  const challengeRef = useRef<ChallengeState>(createChallengeState(defaultSong));
  const [gatewayState, setGatewayState] = useState<GatewayPayload>(defaultGatewayState);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "offline">("offline");
  const [riderConfig, setRiderConfig] = useState(defaultConfig);
  const [audioRunning, setAudioRunning] = useState(false);
  const [sync, setSync] = useState<SyncState>(() => createSyncState());
  const [challenge, setChallenge] = useState<ChallengeState>(() => createChallengeState(defaultSong));
  const [cadenceMultiplier, setCadenceMultiplier] = useState(3);
  const [speedIntensity, setSpeedIntensity] = useState(1.35);
  const [syncWindow, setSyncWindow] = useState(10);
  const [syncMode, setSyncMode] = useState<SyncMode>("experiment");
  const [songId, setSongId] = useState<SongId>("magic-potion");
  const currentSong = useMemo(() => findSong(songId), [songId]);
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
    const resetSync = createSyncState();
    const resetChallenge = createChallengeState(currentSong);
    syncRef.current = resetSync;
    challengeRef.current = resetChallenge;
    setSync(resetSync);
    setChallenge(resetChallenge);
    engineRef.current?.setLayerVolumes(resetChallenge.layerVolumes);
    if (audioRunning && engineRef.current) {
      void engineRef.current.start(currentSong.tracks).then(() => {
        engineRef.current?.setLayerVolumes(resetChallenge.layerVolumes);
      });
    }
  }, [audioRunning, currentSong, syncMode]);

  useEffect(() => {
    if (!audioRunning) {
      return;
    }
    const timer = window.setInterval(() => {
      const current = gatewayRef.current;
      const effectiveCadence1 = current.riders.user1.cadenceRpm * cadenceMultiplier;
      const effectiveCadence2 = current.riders.user2.cadenceRpm * cadenceMultiplier;
      const ridersActive =
        current.riders.user1.online &&
        current.riders.user2.online &&
        effectiveCadence1 >= RIDE_START_CADENCE_RPM &&
        effectiveCadence2 >= RIDE_START_CADENCE_RPM;
      const rider1CadenceForSync = experimentMode ? effectiveCadence1 : current.riders.user1.cadenceRpm;
      const rider2CadenceForSync = experimentMode ? effectiveCadence2 : current.riders.user2.cadenceRpm;
      const nextSync = updateSyncState(syncRef.current, {
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
      const nextChallenge = updateChallengeState(challengeRef.current, {
        dtSeconds: 0.25,
        synced: nextSync.synced,
        ridersActive,
        song: currentSong,
      });
      syncRef.current = nextSync;
      challengeRef.current = nextChallenge;
      setSync(nextSync);
      setChallenge(nextChallenge);
      if (nextChallenge.cue) {
        engineRef.current?.syncToStem("drums");
        engineRef.current?.playStageCue(nextChallenge.cue.kind);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [audioRunning, cadenceMultiplier, currentSong, experimentMode, syncWindow]);

  useEffect(() => {
    if (!audioRunning) {
      return;
    }
    const drumSpeed = rider1Playback.valid ? rider1Playback.speedRatio : 1;
    const guitarSpeed = rider2Playback.valid ? rider2Playback.speedRatio : 1;
    const speeds: TrackSpeeds =
      challenge.stage === 4
        ? { drums: 1, guitar: 1, bass: 1, other: 1, vocals: 1 }
        : {
            drums: drumSpeed,
            guitar: guitarSpeed,
            bass: drumSpeed,
            other: drumSpeed,
            vocals: drumSpeed,
          };
    engineRef.current?.setTrackSpeeds(speeds);
    engineRef.current?.setLayerVolumes(challenge.layerVolumes);
  }, [audioRunning, challenge.layerVolumes, challenge.stage, rider1Playback, rider2Playback]);

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
    await engineRef.current.start(currentSong.tracks);
    engineRef.current.setLayerVolumes(challenge.layerVolumes);
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
          <p className="eyebrow">{currentSong.title}</p>
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
        <SyncPanel sync={sync} challenge={challenge} />
        <RiderPanel
          id="user2"
          label="用户 2"
          trackName="Guitar"
          rider={gatewayState.riders.user2}
          speedRatio={rider2Playback.speedRatio}
          effectiveCadenceRpm={rider2Playback.effectiveCadenceRpm}
          config={riderConfig.user2}
          onConfigChange={(next) => setConfig("user2", next)}
        />
      </section>

      <section className="lower-grid">
        <TrackLayers challenge={challenge} song={currentSong} />
        <section className="panel control-panel">
          <div className="panel-title">
            <RadioTower size={18} />
            <span>实验控制</span>
            <strong>{audioRunning ? "运行中" : "待开始"}</strong>
          </div>
          <label className="range-row">
            <span>歌曲</span>
            <div className="mode-toggle song-toggle" role="group" aria-label="歌曲">
              {SONGS.map((song) => (
                <button key={song.id} className={song.id === songId ? "selected" : ""} onClick={() => setSongId(song.id)}>
                  {song.title}
                </button>
              ))}
            </div>
            <strong>{currentSong.artist}</strong>
          </label>
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
