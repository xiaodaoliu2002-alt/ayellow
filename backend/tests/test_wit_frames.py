import struct
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cycling_synth.wit_frames import parse_packet


def signed(value: int) -> bytes:
    return struct.pack("<h", value)


def standard_frame(frame_type: int, values: tuple[int, int, int, int]) -> bytes:
    payload = b"\x55" + bytes([frame_type]) + b"".join(signed(value) for value in values)
    return payload + bytes([sum(payload) & 0xFF])


class WitFrameTests(unittest.TestCase):
    def test_parses_standard_gyro_angle_and_acc_frames(self) -> None:
        packet = b"".join(
            [
                standard_frame(0x51, (2048, -4096, 8192, 2500)),
                standard_frame(0x52, (3277, -6554, 9830, 2500)),
                standard_frame(0x53, (1820, -3641, 5461, 2500)),
            ]
        )

        sample = parse_packet(packet, "192.168.1.10", 1399)

        self.assertIsNotNone(sample)
        assert sample is not None
        self.assertEqual(sample.source_ip, "192.168.1.10")
        self.assertAlmostEqual(sample.acc_g[0], 1.0, places=3)
        self.assertAlmostEqual(sample.acc_g[1], -2.0, places=3)
        self.assertAlmostEqual(sample.acc_g[2], 4.0, places=3)
        self.assertAlmostEqual(sample.gyro_dps[0], 200.012, places=3)
        self.assertAlmostEqual(sample.gyro_dps[1], -400.024, places=3)
        self.assertAlmostEqual(sample.gyro_dps[2], 599.976, places=3)
        self.assertAlmostEqual(sample.angle_deg[0], 9.998, places=3)
        self.assertAlmostEqual(sample.angle_deg[1], -20.001, places=3)
        self.assertAlmostEqual(sample.angle_deg[2], 29.998, places=3)

    def test_parses_sdk_style_54_byte_packet(self) -> None:
        device_id = b"WT0123456789"
        data = bytearray(54)
        data[:12] = device_id
        data[20:26] = signed(2048) + signed(0) + signed(-2048)
        data[26:32] = signed(5898) + signed(0) + signed(-5898)
        data[38:44] = signed(1820) + signed(0) + signed(-1820)
        data[46:48] = signed(397)
        data[48:50] = signed(-65)

        sample = parse_packet(bytes(data), "192.168.1.11", 1399)

        self.assertIsNotNone(sample)
        assert sample is not None
        self.assertEqual(sample.device_id, "WT0123456789")
        self.assertAlmostEqual(sample.acc_g[0], 1.0, places=3)
        self.assertAlmostEqual(sample.acc_g[2], -1.0, places=3)
        self.assertAlmostEqual(sample.gyro_dps[0], 359.985, places=3)
        self.assertAlmostEqual(sample.gyro_dps[2], -359.985, places=3)
        self.assertAlmostEqual(sample.angle_deg[0], 9.998, places=3)
        self.assertEqual(sample.battery_percent, 100)
        self.assertEqual(sample.rssi, -65)


if __name__ == "__main__":
    unittest.main()
