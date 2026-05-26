from __future__ import annotations

import struct
import time
from dataclasses import dataclass
from typing import Optional


Vector3 = tuple[float, float, float]


@dataclass(frozen=True)
class SensorSample:
    source_ip: str
    source_port: int
    timestamp: float
    device_id: str | None = None
    acc_g: Vector3 | None = None
    gyro_dps: Vector3 | None = None
    angle_deg: Vector3 | None = None
    battery_percent: int | None = None
    rssi: int | None = None


def _signed_short(lo: int, hi: int) -> int:
    return struct.unpack("<h", bytes((lo, hi)))[0]


def _signed_short_pair(data: bytes | bytearray, offset: int) -> int:
    return _signed_short(data[offset], data[offset + 1])


def _checksum_ok(frame: bytes) -> bool:
    return (sum(frame[:-1]) & 0xFF) == frame[-1]


def _battery_percent(raw: int) -> int:
    if raw > 396:
        return 100
    if raw > 393:
        return 90
    if raw > 387:
        return 75
    if raw > 382:
        return 60
    if raw > 379:
        return 50
    if raw > 377:
        return 40
    if raw > 373:
        return 30
    if raw > 370:
        return 20
    if raw > 368:
        return 15
    if raw > 350:
        return 10
    if raw > 340:
        return 5
    return 0


def _merge_sample(base: SensorSample, **changes: object) -> SensorSample:
    values = {
        "source_ip": base.source_ip,
        "source_port": base.source_port,
        "timestamp": base.timestamp,
        "device_id": base.device_id,
        "acc_g": base.acc_g,
        "gyro_dps": base.gyro_dps,
        "angle_deg": base.angle_deg,
        "battery_percent": base.battery_percent,
        "rssi": base.rssi,
    }
    values.update(changes)
    return SensorSample(**values)


def _parse_standard_frames(data: bytes, source_ip: str, source_port: int, timestamp: float) -> Optional[SensorSample]:
    sample = SensorSample(source_ip=source_ip, source_port=source_port, timestamp=timestamp)
    found = False
    index = 0

    while index <= len(data) - 11:
        if data[index] != 0x55:
            index += 1
            continue

        frame = data[index : index + 11]
        if not _checksum_ok(frame):
            index += 1
            continue

        frame_type = frame[1]
        values = tuple(_signed_short_pair(frame, offset) for offset in range(2, 10, 2))

        if frame_type == 0x51:
            sample = _merge_sample(
                sample,
                acc_g=(
                    values[0] / 32768.0 * 16.0,
                    values[1] / 32768.0 * 16.0,
                    values[2] / 32768.0 * 16.0,
                ),
            )
            found = True
        elif frame_type == 0x52:
            sample = _merge_sample(
                sample,
                gyro_dps=(
                    values[0] / 32768.0 * 2000.0,
                    values[1] / 32768.0 * 2000.0,
                    values[2] / 32768.0 * 2000.0,
                ),
            )
            found = True
        elif frame_type == 0x53:
            sample = _merge_sample(
                sample,
                angle_deg=(
                    values[0] / 32768.0 * 180.0,
                    values[1] / 32768.0 * 180.0,
                    values[2] / 32768.0 * 180.0,
                ),
            )
            found = True

        index += 11

    return sample if found else None


def _parse_sdk_packet(data: bytes, source_ip: str, source_port: int, timestamp: float) -> Optional[SensorSample]:
    if len(data) < 54 or data[:2] != b"WT":
        return None

    try:
        device_id = bytes(data[:12]).decode("ascii")
    except UnicodeDecodeError:
        return None

    acc_g = (
        _signed_short_pair(data, 20) / 32768.0 * 16.0,
        _signed_short_pair(data, 22) / 32768.0 * 16.0,
        _signed_short_pair(data, 24) / 32768.0 * 16.0,
    )
    gyro_dps = (
        _signed_short_pair(data, 26) / 32768.0 * 2000.0,
        _signed_short_pair(data, 28) / 32768.0 * 2000.0,
        _signed_short_pair(data, 30) / 32768.0 * 2000.0,
    )
    angle_deg = (
        _signed_short_pair(data, 38) / 32768.0 * 180.0,
        _signed_short_pair(data, 40) / 32768.0 * 180.0,
        _signed_short_pair(data, 42) / 32768.0 * 180.0,
    )
    battery_raw = _signed_short_pair(data, 46)
    rssi = _signed_short_pair(data, 48)

    return SensorSample(
        source_ip=source_ip,
        source_port=source_port,
        timestamp=timestamp,
        device_id=device_id,
        acc_g=acc_g,
        gyro_dps=gyro_dps,
        angle_deg=angle_deg,
        battery_percent=_battery_percent(battery_raw),
        rssi=rssi,
    )


def parse_packet(data: bytes, source_ip: str, source_port: int, timestamp: float | None = None) -> Optional[SensorSample]:
    sample_time = time.time() if timestamp is None else timestamp
    return _parse_sdk_packet(data, source_ip, source_port, sample_time) or _parse_standard_frames(
        data, source_ip, source_port, sample_time
    )
