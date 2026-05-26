from __future__ import annotations

import argparse
import asyncio
import json
import signal
from typing import Any

import websockets

from .gateway import GatewayState
from .wit_frames import parse_packet


class SensorDatagramProtocol(asyncio.DatagramProtocol):
    def __init__(self, gateway: GatewayState, verbose: bool = False) -> None:
        self.gateway = gateway
        self.verbose = verbose

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        sample = parse_packet(data, addr[0], addr[1])
        if sample is not None:
            rider_id = self.gateway._bound_rider_for_ip(sample.source_ip)
            self.gateway.ingest(sample)
            if self.verbose:
                print(f"packet {sample.source_ip}:{sample.source_port} rider={rider_id} gyro={sample.gyro_dps}")


class CyclingSynthServer:
    def __init__(self, udp_port: int = 1399, ws_port: int = 8765, verbose: bool = False) -> None:
        self.udp_port = udp_port
        self.ws_port = ws_port
        self.verbose = verbose
        self.gateway = GatewayState()
        self.clients: set[Any] = set()

    async def run(self) -> None:
        loop = asyncio.get_running_loop()
        transport, _ = await loop.create_datagram_endpoint(
            lambda: SensorDatagramProtocol(self.gateway, self.verbose),
            local_addr=("0.0.0.0", self.udp_port),
        )
        stop_event = asyncio.Event()

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop_event.set)
            except NotImplementedError:
                pass

        async with websockets.serve(self._client_handler, "0.0.0.0", self.ws_port):
            broadcaster = asyncio.create_task(self._broadcast_loop())
            print(f"Sensor UDP listening on 0.0.0.0:{self.udp_port}")
            print(f"WebSocket state stream on ws://localhost:{self.ws_port}")
            await stop_event.wait()
            broadcaster.cancel()
            transport.close()

    async def _client_handler(self, websocket: Any) -> None:
        self.clients.add(websocket)
        try:
            await websocket.send(json.dumps(self.gateway.to_payload()))
            async for raw in websocket:
                self._handle_client_message(raw)
        finally:
            self.clients.discard(websocket)

    def _handle_client_message(self, raw: str | bytes) -> None:
        try:
            message: dict[str, Any] = json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            return

        if message.get("type") == "config":
            self.gateway.update_config(message)
            if self.verbose:
                print(f"config {message.get('riders', {})}")

    async def _broadcast_loop(self) -> None:
        while True:
            await asyncio.sleep(0.1)
            if not self.clients:
                continue

            payload = json.dumps(self.gateway.to_payload())
            stale_clients: list[Any] = []
            for client in self.clients:
                try:
                    await client.send(payload)
                except websockets.ConnectionClosed:
                    stale_clients.append(client)

            for client in stale_clients:
                self.clients.discard(client)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the cycling synth sensor gateway.")
    parser.add_argument("--udp-port", type=int, default=1399)
    parser.add_argument("--ws-port", type=int, default=8765)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    asyncio.run(CyclingSynthServer(args.udp_port, args.ws_port, args.verbose).run())


if __name__ == "__main__":
    main()
