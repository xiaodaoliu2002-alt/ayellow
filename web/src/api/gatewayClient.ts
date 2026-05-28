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

export interface GatewayAnimationPayload {
  stage: 1 | 2 | 3 | 4;
  progress: number;
  congratulations: "playing" | "idle";
  stage4Video: "playing" | "idle";
}

export interface RadiusMappingPayload {
  minRpm: number;
  maxRpm: number;
  minRadius: number;
  maxRadius: number;
}

export interface GatewayPayload {
  type: "state";
  timestamp: number;
  riders: Record<RiderId, RiderPayload>;
  discoveredSensors: DiscoveredSensor[];
  animation: GatewayAnimationPayload;
  radiusMapping: RadiusMappingPayload;
}

export interface RiderConfigPayload {
  sensorIp: string;
  frontTeeth: number;
  rearTeeth: number;
  axis: Axis;
}

const DEFAULT_GATEWAY_PORT = 8765;

type GatewayImportMeta = ImportMeta & {
  env?: {
    VITE_GATEWAY_WS_URL?: string;
  };
};

function configuredGatewayUrl(): string | undefined {
  return (import.meta as GatewayImportMeta).env?.VITE_GATEWAY_WS_URL;
}

export function resolveGatewayUrl(
  pageUrl: Pick<Location, "hostname" | "protocol"> | URL = window.location,
  configuredUrl = configuredGatewayUrl(),
): string {
  if (configuredUrl) {
    return configuredUrl;
  }
  const websocketProtocol = pageUrl.protocol === "https:" ? "wss:" : "ws:";
  const hostname = pageUrl.hostname || "127.0.0.1";
  return `${websocketProtocol}//${hostname}:${DEFAULT_GATEWAY_PORT}`;
}

export function gatewayEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
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

  sendAnimation(animation: Partial<GatewayAnimationPayload>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify({ type: "animation", animation }));
  }

  sendRadiusMapping(radiusMapping: RadiusMappingPayload): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify({ type: "radiusMapping", radiusMapping }));
  }

  close(): void {
    this.shouldReconnect = false;
    this.socket?.close();
  }
}
