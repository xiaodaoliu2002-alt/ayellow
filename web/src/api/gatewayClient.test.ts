import { describe, expect, it } from "vitest";
import { gatewayEndpointLabel, resolveGatewayUrl } from "./gatewayClient";

describe("resolveGatewayUrl", () => {
  it("uses the current page host for LAN access", () => {
    const url = resolveGatewayUrl(new URL("http://172.20.10.14:5174/"));

    expect(url).toBe("ws://172.20.10.14:8765");
  });

  it("keeps secure pages on secure websockets", () => {
    const url = resolveGatewayUrl(new URL("https://bike-music.local/"));

    expect(url).toBe("wss://bike-music.local:8765");
  });
});

describe("gatewayEndpointLabel", () => {
  it("shows the gateway host and port without protocol noise", () => {
    expect(gatewayEndpointLabel("ws://172.20.10.14:8765")).toBe("172.20.10.14:8765");
  });
});
