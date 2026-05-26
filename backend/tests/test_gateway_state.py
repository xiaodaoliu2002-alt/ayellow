import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cycling_synth.gateway import GatewayState
from cycling_synth.wit_frames import SensorSample


class GatewayStateTests(unittest.TestCase):
    def test_updates_bound_rider_and_lists_unbound_sensor(self) -> None:
        state = GatewayState()
        state.update_config(
            {
                "riders": {
                    "user1": {"sensorIp": "192.168.1.10", "frontTeeth": 42, "rearTeeth": 21, "axis": "z"},
                    "user2": {"sensorIp": "192.168.1.11", "frontTeeth": 40, "rearTeeth": 20, "axis": "x"},
                }
            }
        )

        bound_sample = SensorSample(
            source_ip="192.168.1.10",
            source_port=1399,
            timestamp=10.0,
            gyro_dps=(0.0, 0.0, 720.0),
        )
        unbound_sample = SensorSample(
            source_ip="192.168.1.99",
            source_port=1399,
            timestamp=10.0,
            gyro_dps=(0.0, 0.0, 720.0),
        )

        state.ingest(bound_sample)
        state.ingest(unbound_sample)
        payload = state.to_payload(now=10.5)

        self.assertAlmostEqual(payload["riders"]["user1"]["cadenceRpm"], 60.0, places=3)
        self.assertEqual(payload["riders"]["user1"]["sensorIp"], "192.168.1.10")
        self.assertEqual(payload["riders"]["user2"]["status"], "waiting")
        self.assertEqual(payload["discoveredSensors"][0]["ip"], "192.168.1.99")

    def test_marks_bound_rider_stale(self) -> None:
        state = GatewayState(stale_seconds=3)
        state.update_config({"riders": {"user1": {"sensorIp": "192.168.1.10", "axis": "z"}}})
        state.ingest(
            SensorSample(
                source_ip="192.168.1.10",
                source_port=1399,
                timestamp=1.0,
                gyro_dps=(0.0, 0.0, 720.0),
            )
        )

        payload = state.to_payload(now=5.0)

        self.assertEqual(payload["riders"]["user1"]["status"], "stale")
        self.assertEqual(payload["riders"]["user1"]["online"], False)

    def test_empty_sensor_ip_does_not_clear_existing_binding(self) -> None:
        state = GatewayState()
        state.update_config({"riders": {"user1": {"sensorIp": "192.168.1.10", "axis": "z"}}})

        state.update_config({"riders": {"user1": {"sensorIp": "", "frontTeeth": 50}}})
        payload = state.to_payload(now=1.0)

        self.assertEqual(payload["riders"]["user1"]["sensorIp"], "192.168.1.10")
        self.assertEqual(payload["riders"]["user1"]["frontTeeth"], 50)


if __name__ == "__main__":
    unittest.main()
