#!/usr/bin/env python3
"""
Receive and inspect WT901WIFI real-time data.

Default mode is UDP on port 1399, matching the WitMotion PC software port.
The script prints every packet and decodes common WIT binary frames when found.
"""

from __future__ import annotations

import argparse
import select
import socket
import struct
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Tuple


FrameValues = Dict[str, Tuple[float, float, float]]


@dataclass
class DeviceState:
    label: str
    parser_buffer: bytearray = field(default_factory=bytearray)
    packets: int = 0
    bytes_total: int = 0
    decoded_frames: int = 0
    first_seen: float | None = None
    last_seen: float | None = None
    last_source: str = ""
    last_raw: str = ""
    last_decoded: str = ""


def signed_short(lo: int, hi: int) -> int:
    return struct.unpack("<h", bytes((lo, hi)))[0]


def checksum_ok(frame: bytes) -> bool:
    return (sum(frame[:-1]) & 0xFF) == frame[-1]


def decode_standard_frame(frame: bytes) -> str | None:
    if len(frame) != 11 or frame[0] != 0x55 or not checksum_ok(frame):
        return None

    frame_type = frame[1]
    values = [signed_short(frame[i], frame[i + 1]) for i in range(2, 10, 2)]

    if frame_type == 0x50:
        yy, mm, dd, hh = frame[2], frame[3], frame[4], frame[5]
        minute, second, ms = frame[6], frame[7], signed_short(frame[8], frame[9])
        return f"time=20{yy:02d}-{mm:02d}-{dd:02d} {hh:02d}:{minute:02d}:{second:02d}.{ms:03d}"

    if frame_type == 0x51:
        ax, ay, az = (v / 32768.0 * 16.0 for v in values[:3])
        temp = values[3] / 100.0
        return f"acc(g)=({ax:.4f}, {ay:.4f}, {az:.4f}) temp={temp:.2f}C"

    if frame_type == 0x52:
        gx, gy, gz = (v / 32768.0 * 2000.0 for v in values[:3])
        temp = values[3] / 100.0
        return f"gyro(deg/s)=({gx:.3f}, {gy:.3f}, {gz:.3f}) temp={temp:.2f}C"

    if frame_type == 0x53:
        roll, pitch, yaw = (v / 32768.0 * 180.0 for v in values[:3])
        temp = values[3] / 100.0
        return f"angle(deg)=({roll:.3f}, {pitch:.3f}, {yaw:.3f}) temp={temp:.2f}C"

    if frame_type == 0x54:
        mx, my, mz = values[:3]
        temp = values[3] / 100.0
        return f"mag=({mx}, {my}, {mz}) temp={temp:.2f}C"

    if frame_type == 0x59:
        q0, q1, q2, q3 = (v / 32768.0 for v in values)
        return f"quat=({q0:.5f}, {q1:.5f}, {q2:.5f}, {q3:.5f})"

    return f"wit_frame type=0x{frame_type:02X} data={frame[2:10].hex(' ')}"


def decode_compact_0x61(frame: bytes) -> str | None:
    """Decode the 20-byte compact frame used by some WIT wireless products."""
    if len(frame) != 20 or frame[:2] != b"\x55\x61":
        return None

    raw = [signed_short(frame[i], frame[i + 1]) for i in range(2, 20, 2)]
    ax, ay, az = (v / 32768.0 * 16.0 for v in raw[0:3])
    gx, gy, gz = (v / 32768.0 * 2000.0 for v in raw[3:6])
    roll, pitch, yaw = (v / 32768.0 * 180.0 for v in raw[6:9])
    return (
        f"compact61 acc(g)=({ax:.4f}, {ay:.4f}, {az:.4f}) "
        f"gyro(deg/s)=({gx:.3f}, {gy:.3f}, {gz:.3f}) "
        f"angle(deg)=({roll:.3f}, {pitch:.3f}, {yaw:.3f})"
    )


def iter_decoded_frames(buffer: bytearray) -> Iterable[str]:
    while True:
        try:
            start = buffer.index(0x55)
        except ValueError:
            buffer.clear()
            return

        if start:
            del buffer[:start]

        if len(buffer) < 11:
            return

        if len(buffer) >= 20 and buffer[1] == 0x61:
            decoded = decode_compact_0x61(bytes(buffer[:20]))
            if decoded:
                del buffer[:20]
                yield decoded
                continue

        decoded = decode_standard_frame(bytes(buffer[:11]))
        if decoded:
            del buffer[:11]
            yield decoded
            continue

        del buffer[0]


def print_packet(source: str, data: bytes, device: DeviceState, show_raw: bool) -> None:
    now = time.strftime("%H:%M:%S")
    device.packets += 1
    device.bytes_total += len(data)
    device.first_seen = device.first_seen or time.time()
    device.last_seen = time.time()
    device.last_source = source
    device.last_raw = data.hex(" ")

    print(f"\n[{now}] {device.label} from {source} {len(data)} bytes")
    if show_raw:
        print(f"raw: {device.last_raw}")

    try:
        text = data.decode("utf-8").strip()
    except UnicodeDecodeError:
        text = ""
    if text and all(ch.isprintable() or ch.isspace() for ch in text):
        print(f"text: {text}")

    device.parser_buffer.extend(data)
    for decoded in iter_decoded_frames(device.parser_buffer):
        device.decoded_frames += 1
        device.last_decoded = decoded
        print(f"decoded: {decoded}")

    sys.stdout.flush()


def parse_expected(values: List[str]) -> List[str]:
    expected: List[str] = []
    for value in values:
        expected.extend(part.strip() for part in value.split(",") if part.strip())
    return expected


def parse_ports(values: List[str], default_port: int) -> List[int]:
    ports: List[int] = []
    if not values:
        return [default_port]

    for value in values:
        for part in value.split(","):
            part = part.strip()
            if not part:
                continue
            port = int(part)
            if port < 1 or port > 65535:
                raise ValueError(f"Invalid port: {port}")
            ports.append(port)
    return list(dict.fromkeys(ports))


def device_key_from_addr(addr: Tuple[str, int], split_by_port: bool) -> str:
    if split_by_port:
        return f"{addr[0]}:{addr[1]}"
    return addr[0]


def ensure_device(
    devices: Dict[str, DeviceState],
    key: str,
    expected: List[str],
) -> DeviceState:
    if key not in devices:
        if key in expected:
            label = f"sensor {expected.index(key) + 1} ({key})"
        else:
            label = f"sensor {len(devices) + 1} ({key})"
        devices[key] = DeviceState(label=label)
    return devices[key]


def print_summary(devices: Dict[str, DeviceState], expected: List[str], stale_seconds: float) -> None:
    now = time.time()
    rows = []
    keys = list(dict.fromkeys(expected + list(devices.keys())))
    for index, key in enumerate(keys, start=1):
        device = devices.get(key)
        label = device.label if device else f"sensor {index} ({key})"
        if not device or device.last_seen is None:
            rows.append((label, "WAITING", "-", "0", "0", ""))
            continue

        age = now - device.last_seen
        status = "OK" if age <= stale_seconds else "STALE"
        last_seen = time.strftime("%H:%M:%S", time.localtime(device.last_seen))
        rows.append((
            label,
            status,
            f"{age:.1f}s ago at {last_seen}",
            str(device.packets),
            str(device.decoded_frames),
            device.last_decoded,
        ))

    print("\n--- sensor status ---")
    print(f"{'device':<28} {'status':<8} {'last seen':<23} {'packets':<8} {'decoded':<8} last decoded")
    for row in rows:
        print(f"{row[0]:<28} {row[1]:<8} {row[2]:<23} {row[3]:<8} {row[4]:<8} {row[5]}")
    sys.stdout.flush()


def udp_server(
    host: str,
    ports: List[int],
    expected: List[str],
    split_by_port: bool,
    summary_interval: float,
    stale_seconds: float,
    show_raw: bool,
    self_test: bool,
) -> None:
    devices: Dict[str, DeviceState] = {}
    for key in expected:
        devices[key] = DeviceState(label=f"sensor {expected.index(key) + 1} ({key})")

    sockets: List[socket.socket] = []
    try:
        for port in ports:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((host, port))
            sock.setblocking(False)
            sockets.append(sock)

        port_text = ",".join(str(port) for port in ports)
        print(f"Listening for UDP packets on {host}:{port_text}")
        if expected:
            print(f"Expecting sensors: {', '.join(expected)}")
        print("Tip: configure both WT901WIFI sensors to send UDP to this computer IP and one of these ports.")
        if self_test:
            for port in ports:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as test_sock:
                    test_sock.sendto(f"self-test-to-local-port-{port}".encode(), ("127.0.0.1", port))
        next_summary = time.time() + summary_interval

        while True:
            readable, _, _ = select.select(sockets, [], [], 0.5)
            for sock in readable:
                data, addr = sock.recvfrom(4096)
                local_port = sock.getsockname()[1]
                key = device_key_from_addr(addr, split_by_port)
                device = ensure_device(devices, key, expected)
                print_packet(f"{addr[0]}:{addr[1]} -> local:{local_port}", data, device, show_raw)

            if time.time() >= next_summary:
                print_summary(devices, expected, stale_seconds)
                next_summary = time.time() + summary_interval
    finally:
        for sock in sockets:
            sock.close()


def handle_tcp_client(conn: socket.socket, addr: Tuple[str, int], show_raw: bool) -> None:
    device = DeviceState(label=f"sensor ({addr[0]})")
    print(f"TCP connected from {addr[0]}:{addr[1]}")
    with conn:
        while True:
            data = conn.recv(4096)
            if not data:
                print(f"TCP disconnected from {addr[0]}:{addr[1]}")
                break
            print_packet(f"{addr[0]}:{addr[1]}", data, device, show_raw)


def tcp_server(host: str, port: int, show_raw: bool) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind((host, port))
        server.listen(5)
        print(f"Listening for TCP connection on {host}:{port}")
        while True:
            conn, addr = server.accept()
            thread = threading.Thread(target=handle_tcp_client, args=(conn, addr, show_raw), daemon=True)
            thread.start()


def main() -> None:
    parser = argparse.ArgumentParser(description="Receive WT901WIFI UDP/TCP sensor data.")
    parser.add_argument("--protocol", choices=("udp", "tcp"), default="udp")
    parser.add_argument("--host", default="0.0.0.0", help="Local IP to bind. Keep 0.0.0.0 for all interfaces.")
    parser.add_argument("--port", type=int, default=1399, help="Local port configured on the WT901WIFI.")
    parser.add_argument(
        "--ports",
        action="append",
        default=[],
        help="UDP ports to listen on. Can be repeated or comma-separated, for example: --ports 1399,8899,5000",
    )
    parser.add_argument(
        "--expect",
        action="append",
        default=[],
        help="Expected sensor IP. Can be repeated or comma-separated, for example: --expect 172.20.10.21,172.20.10.22",
    )
    parser.add_argument(
        "--split-by-port",
        action="store_true",
        help="Treat packets from the same IP but different source ports as different devices.",
    )
    parser.add_argument("--summary-interval", type=float, default=5.0, help="Seconds between status summaries.")
    parser.add_argument("--stale-seconds", type=float, default=3.0, help="Mark a sensor STALE after this many silent seconds.")
    parser.add_argument("--no-raw", action="store_true", help="Hide raw hex packet output.")
    parser.add_argument("--self-test", action="store_true", help="Send a local UDP packet to verify this receiver is working.")
    args = parser.parse_args()
    expected = parse_expected(args.expect)
    ports = parse_ports(args.ports, args.port)

    if args.protocol == "udp":
        udp_server(
            args.host,
            ports,
            expected,
            args.split_by_port,
            args.summary_interval,
            args.stale_seconds,
            not args.no_raw,
            args.self_test,
        )
    else:
        tcp_server(args.host, args.port, not args.no_raw)


if __name__ == "__main__":
    main()
