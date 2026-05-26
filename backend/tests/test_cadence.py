import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cycling_synth.cadence import RiderConfig, RiderState, update_rider_from_gyro


class CadenceTests(unittest.TestCase):
    def test_converts_wheel_gyro_to_cadence_with_gear_ratio(self) -> None:
        config = RiderConfig(front_teeth=42, rear_teeth=16, axis="z", smoothing_seconds=0)
        state = RiderState(config=config)

        updated = update_rider_from_gyro(state, (0.0, 0.0, 360.0), timestamp=10.0)

        self.assertAlmostEqual(updated.wheel_rpm, 60.0, places=3)
        self.assertAlmostEqual(updated.cadence_rpm, 22.857, places=3)
        self.assertEqual(updated.status, "stopped")

    def test_subtracts_bias_and_clamps_cadence(self) -> None:
        config = RiderConfig(front_teeth=34, rear_teeth=34, axis="x", gyro_bias_dps=20.0, smoothing_seconds=0)
        state = RiderState(config=config)

        updated = update_rider_from_gyro(state, (1220.0, 0.0, 0.0), timestamp=10.0)

        self.assertAlmostEqual(updated.wheel_rpm, 200.0, places=3)
        self.assertEqual(updated.cadence_rpm, 140.0)

    def test_smoothing_limits_abrupt_changes(self) -> None:
        config = RiderConfig(front_teeth=40, rear_teeth=20, axis="y", smoothing_seconds=2)
        state = RiderState(config=config)

        first = update_rider_from_gyro(state, (0.0, 360.0, 0.0), timestamp=1.0)
        second = update_rider_from_gyro(first, (0.0, 720.0, 0.0), timestamp=2.0)

        self.assertAlmostEqual(first.cadence_rpm, 30.0, places=3)
        self.assertAlmostEqual(second.cadence_rpm, 40.0, places=3)

    def test_tracks_crank_phase_from_integrated_wheel_rotation(self) -> None:
        config = RiderConfig(front_teeth=40, rear_teeth=20, axis="z", smoothing_seconds=0)
        state = RiderState(config=config)

        first = update_rider_from_gyro(state, (0.0, 0.0, 360.0), timestamp=1.0)
        second = update_rider_from_gyro(first, (0.0, 0.0, 360.0), timestamp=2.0)

        self.assertAlmostEqual(second.wheel_revolutions, 1.0, places=3)
        self.assertAlmostEqual(second.rhythm_phase, 0.5, places=3)

    def test_marks_stale_after_timeout(self) -> None:
        config = RiderConfig(axis="z")
        state = RiderState(config=config, last_seen=1.0)

        self.assertTrue(state.is_stale(now=5.0, stale_seconds=3.0))
        self.assertFalse(state.is_stale(now=3.0, stale_seconds=3.0))


if __name__ == "__main__":
    unittest.main()
