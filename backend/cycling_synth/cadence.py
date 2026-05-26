from __future__ import annotations

from dataclasses import dataclass, replace
from math import isfinite
from typing import Literal


Axis = Literal["x", "y", "z"]
Status = Literal["waiting", "active", "stopped"]


@dataclass(frozen=True)
class RiderConfig:
    sensor_ip: str = ""
    front_teeth: int = 42
    rear_teeth: int = 16
    axis: Axis = "z"
    gyro_bias_dps: float = 0.0
    baseline_cadence_rpm: float = 80.0
    smoothing_seconds: float = 1.5


@dataclass(frozen=True)
class RiderState:
    config: RiderConfig
    wheel_rpm: float = 0.0
    wheel_revolutions: float = 0.0
    rhythm_phase: float = 0.0
    cadence_rpm: float = 0.0
    raw_cadence_rpm: float = 0.0
    status: Status = "waiting"
    confidence: float = 0.0
    last_seen: float | None = None

    def is_stale(self, now: float, stale_seconds: float) -> bool:
        if self.last_seen is None:
            return True
        return now - self.last_seen > stale_seconds


def _axis_value(gyro_dps: tuple[float, float, float], axis: Axis) -> float:
    return gyro_dps[{"x": 0, "y": 1, "z": 2}[axis]]


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _smooth(previous: RiderState, raw: float, timestamp: float, smoothing_seconds: float) -> float:
    if previous.last_seen is None or smoothing_seconds <= 0:
        return raw
    dt = max(0.0, timestamp - previous.last_seen)
    alpha = _clamp(dt / (smoothing_seconds + dt), 0.0, 1.0)
    return previous.cadence_rpm + (raw - previous.cadence_rpm) * alpha


def update_rider_from_gyro(
    state: RiderState,
    gyro_dps: tuple[float, float, float],
    timestamp: float,
    min_cadence_rpm: float = 30.0,
    max_cadence_rpm: float = 140.0,
) -> RiderState:
    signed_axis_dps = _axis_value(gyro_dps, state.config.axis) - state.config.gyro_bias_dps
    axis_dps = abs(signed_axis_dps)
    wheel_rpm = axis_dps / 360.0 * 60.0

    if state.config.front_teeth <= 0 or state.config.rear_teeth <= 0:
        raw_cadence = 0.0
        rhythm_phase = state.rhythm_phase
    else:
        raw_cadence = wheel_rpm * state.config.rear_teeth / state.config.front_teeth
        if state.last_seen is None:
            wheel_revolutions = state.wheel_revolutions
        else:
            dt = max(0.0, timestamp - state.last_seen)
            wheel_revolutions = state.wheel_revolutions + (axis_dps / 360.0) * dt
        rhythm_phase = (wheel_revolutions * state.config.rear_teeth / state.config.front_teeth) % 1.0

    if not isfinite(raw_cadence):
        raw_cadence = 0.0
    if state.config.front_teeth <= 0 or state.config.rear_teeth <= 0:
        wheel_revolutions = state.wheel_revolutions

    clamped_raw = _clamp(raw_cadence, 0.0, max_cadence_rpm)
    cadence = _smooth(state, clamped_raw, timestamp, state.config.smoothing_seconds)
    cadence = _clamp(cadence, 0.0, max_cadence_rpm)
    status: Status = "stopped" if cadence < min_cadence_rpm else "active"
    confidence = 1.0 if status == "active" else 0.35 if cadence > 0 else 0.0

    return replace(
        state,
        wheel_rpm=wheel_rpm,
        wheel_revolutions=wheel_revolutions,
        rhythm_phase=rhythm_phase,
        raw_cadence_rpm=raw_cadence,
        cadence_rpm=cadence,
        status=status,
        confidence=confidence,
        last_seen=timestamp,
    )
