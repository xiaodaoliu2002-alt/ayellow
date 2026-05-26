export type RiderId = "user1" | "user2";
export type Axis = "x" | "y" | "z";

export interface RiderPayload {
  id: RiderId;
  sensorIp: string;
  frontTeeth: number;
  rearTeeth: number;
  axis: Axis;
  baselineCadenceRpm: number;
  wheelRpm: number;
  rhythmPhase: number | null;
  cadenceRpm: number;
  rawCadenceRpm: number;
  status: string;
  online: boolean;
  confidence: number;
  lastSeen: number | null;
}

export interface DiscoveredSensor {
  ip: string;
  port: number;
  deviceId: string | null;
  lastSeen: number;
}

export interface GatewayPayload {
  type: "state";
  timestamp: number;
  riders: Record<RiderId, RiderPayload>;
  discoveredSensors: DiscoveredSensor[];
}

export interface RiderConfigPayload {
  sensorIp: string;
  frontTeeth: number;
  rearTeeth: number;
  axis: Axis;
}

export class GatewayClient {
  private socket: WebSocket | null = null;
  private shouldReconnect = true;
  private lastConfig: Record<RiderId, RiderConfigPayload> | null = null;

  constructor(
    private readonly url: string,
    private readonly onState: (state: GatewayPayload) => void,
    private readonly onStatus: (status: "connected" | "connecting" | "offline") => void,
  ) {}

  connect(): void {
    this.shouldReconnect = true;
    this.onStatus("connecting");
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("open", () => {
      this.onStatus("connected");
      if (this.lastConfig) {
        this.sendConfig(this.lastConfig);
      }
    });
    this.socket.addEventListener("close", () => {
      this.onStatus("offline");
      if (this.shouldReconnect) {
        window.setTimeout(() => this.connect(), 1200);
      }
    });
    this.socket.addEventListener("error", () => this.onStatus("offline"));
    this.socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data) as GatewayPayload;
        if (payload.type === "state") {
          this.onState(payload);
        }
      } catch {
        // Ignore malformed development messages.
      }
    });
  }

  sendConfig(riders: Record<RiderId, RiderConfigPayload>): void {
    this.lastConfig = riders;
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify({ type: "config", riders }));
  }

  close(): void {
    this.shouldReconnect = false;
    this.socket?.close();
  }
}
