from __future__ import annotations

import time
from dataclasses import dataclass, field, replace
from typing import Any

from .cadence import Axis, RiderConfig, RiderState, update_rider_from_gyro
from .wit_frames import SensorSample


RIDER_IDS = ("user1", "user2")


def _safe_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _safe_axis(value: Any, fallback: Axis) -> Axis:
    return value if value in ("x", "y", "z") else fallback


@dataclass
class DiscoveredSensor:
    ip: str
    port: int
    last_seen: float
    device_id: str | None = None


@dataclass
class GatewayState:
    stale_seconds: float = 3.0
    riders: dict[str, RiderState] = field(
        default_factory=lambda: {
            "user1": RiderState(config=RiderConfig(axis="z")),
            "user2": RiderState(config=RiderConfig(axis="z")),
        }
    )
    discovered: dict[str, DiscoveredSensor] = field(default_factory=dict)

    def update_config(self, message: dict[str, Any]) -> None:
        riders_config = message.get("riders", {})
        for rider_id in RIDER_IDS:
            if rider_id not in riders_config:
                continue

            incoming = riders_config[rider_id]
            current_state = self.riders[rider_id]
            current_config = current_state.config
            incoming_sensor_ip = str(incoming.get("sensorIp", "")).strip()
            updated_config = replace(
                current_config,
                sensor_ip=incoming_sensor_ip or current_config.sensor_ip,
                front_teeth=_safe_int(incoming.get("frontTeeth"), current_config.front_teeth),
                rear_teeth=_safe_int(incoming.get("rearTeeth"), current_config.rear_teeth),
                axis=_safe_axis(incoming.get("axis"), current_config.axis),
            )
            self.riders[rider_id] = replace(current_state, config=updated_config)

    def ingest(self, sample: SensorSample) -> None:
        rider_id = self._bound_rider_for_ip(sample.source_ip)
        if rider_id is None:
            self.discovered[sample.source_ip] = DiscoveredSensor(
                ip=sample.source_ip,
                port=sample.source_port,
                last_seen=sample.timestamp,
                device_id=sample.device_id,
            )
            return

        if sample.gyro_dps is None:
            return

        self.riders[rider_id] = update_rider_from_gyro(
            self.riders[rider_id],
            sample.gyro_dps,
            sample.timestamp,
        )

    def to_payload(self, now: float | None = None) -> dict[str, Any]:
        payload_time = time.time() if now is None else now
        return {
            "type": "state",
            "timestamp": payload_time,
            "riders": {rider_id: self._rider_payload(rider_id, payload_time) for rider_id in RIDER_IDS},
            "discoveredSensors": self._discovered_payload(payload_time),
        }

    def _bound_rider_for_ip(self, source_ip: str) -> str | None:
        for rider_id, state in self.riders.items():
            if state.config.sensor_ip and state.config.sensor_ip == source_ip:
                return rider_id
        return None

    def _rider_payload(self, rider_id: str, now: float) -> dict[str, Any]:
        state = self.riders[rider_id]
        stale = state.is_stale(now, self.stale_seconds)
        status = "stale" if stale and state.last_seen is not None else state.status
        online = state.last_seen is not None and not stale
        return {
            "id": rider_id,
            "sensorIp": state.config.sensor_ip,
            "frontTeeth": state.config.front_teeth,
            "rearTeeth": state.config.rear_teeth,
            "axis": state.config.axis,
            "baselineCadenceRpm": state.config.baseline_cadence_rpm,
            "wheelRpm": round(state.wheel_rpm, 3),
            "rhythmPhase": round(state.rhythm_phase, 4),
            "cadenceRpm": round(state.cadence_rpm, 3),
            "rawCadenceRpm": round(state.raw_cadence_rpm, 3),
            "status": status,
            "online": online,
            "confidence": round(0.0 if stale else state.confidence, 3),
            "lastSeen": state.last_seen,
        }

    def _discovered_payload(self, now: float) -> list[dict[str, Any]]:
        bound_ips = {state.config.sensor_ip for state in self.riders.values() if state.config.sensor_ip}
        sensors = [
            sensor
            for sensor in self.discovered.values()
            if sensor.ip not in bound_ips and now - sensor.last_seen <= 30
        ]
        sensors.sort(key=lambda sensor: sensor.last_seen, reverse=True)
        return [
            {
                "ip": sensor.ip,
                "port": sensor.port,
                "deviceId": sensor.device_id,
                "lastSeen": sensor.last_seen,
            }
            for sensor in sensors
        ]
