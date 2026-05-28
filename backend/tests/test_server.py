import asyncio
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cycling_synth.server import CyclingSynthServer


class WorkingClient:
    def __init__(self) -> None:
        self.messages: list[str] = []

    async def send(self, payload: str) -> None:
        self.messages.append(payload)


class BrokenClient:
    async def send(self, payload: str) -> None:
        raise RuntimeError("client write failed")


class ServerBroadcastTests(unittest.TestCase):
    def test_handles_animation_messages(self) -> None:
        server = CyclingSynthServer()

        server._handle_client_message('{"type":"animation","animation":{"stage":2,"progress":0.4,"congratulations":"playing"}}')
        payload = server.gateway.to_payload(now=1.0)["animation"]
        self.assertEqual(payload["stage"], 2)
        self.assertEqual(payload["progress"], 0.4)
        self.assertEqual(payload["congratulations"], "playing")

        server._handle_client_message('{"type":"animation","animation":{"stage":4,"stage4Video":"playing","congratulations":"idle"}}')
        payload = server.gateway.to_payload(now=2.0)["animation"]
        self.assertEqual(payload["stage"], 4)
        self.assertEqual(payload["stage4Video"], "playing")
        self.assertEqual(payload["congratulations"], "idle")

    def test_handles_radius_mapping_messages(self) -> None:
        server = CyclingSynthServer()

        server._handle_client_message('{"type":"radiusMapping","radiusMapping":{"minRpm":0,"maxRpm":24,"minRadius":8,"maxRadius":42}}')
        payload = server.gateway.to_payload(now=1.0)["radiusMapping"]

        self.assertEqual(payload["maxRpm"], 24.0)
        self.assertEqual(payload["maxRadius"], 42)

    def test_broadcast_loop_removes_failed_clients_and_keeps_sending(self) -> None:
        async def run_case() -> None:
            server = CyclingSynthServer()
            working = WorkingClient()
            broken = BrokenClient()
            server.clients.update({working, broken})

            task = asyncio.create_task(server._broadcast_loop())
            await asyncio.sleep(0.25)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            self.assertGreaterEqual(len(working.messages), 2)
            self.assertIn(working, server.clients)
            self.assertNotIn(broken, server.clients)

        asyncio.run(run_case())


if __name__ == "__main__":
    unittest.main()
