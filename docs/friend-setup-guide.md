# ayellow + 传感器 + M5Stack 配置指南

这份文档给第一次接手本 demo 的朋友使用。目标是让两只 WT901 Wi-Fi 传感器、电脑上的 ayellow、以及 M5Stack / M5StickS3 在同一个局域网里协作：传感器把姿态/角速度数据发到电脑，ayellow 计算踏频、同步进度和阶段动画信号，M5Stack 通过 WebSocket 接收这些信号并显示两个球和阶段动画。

## 1. 硬件与技术栈

### 硬件

- 电脑：运行 ayellow 后端和前端。
- 两个 WT901 Wi-Fi 传感器：通过 UDP 向电脑发送传感器帧。
- M5Stack Basic v2.7 / Core ESP32：主显示设备，屏幕 320×240。
- M5StickS3：可选小屏显示设备，使用同一套逻辑的小屏适配版本。
- USB 数据线：用于给 M5Stack / M5StickS3 烧录固件。

### ayellow 技术栈

- Backend：Python。
- 传感器接收：UDP，默认端口 `1399`。
- 状态广播：WebSocket，默认端口 `8765`。
- Frontend：React + Vite + TypeScript。
- 前端用途：查看传感器状态、调音乐/阶段逻辑、调 RPM→球半径映射、向后端发送 M5Stack 动画信号。

### M5Stack 技术栈

- PlatformIO。
- Arduino framework。
- M5Stack Core 环境：`board = m5stack-core-esp32`，库 `m5stack/M5Stack`。
- M5StickS3 环境：`board = m5stack-stamps3`，库 `m5stack/M5Unified`。
- WebSocket 客户端库：`links2004/WebSockets`。
- 固件目录：`m5stack_dual_balls/`。
- 主要固件文件：`m5stack_dual_balls/src/main.cpp`。

## 2. 网络配置

所有设备必须连到同一个 Wi-Fi。

需要记录这些值：

| 项目 | 示例/默认值 | 需要改哪里 |
| --- | --- | --- |
| Wi-Fi 名称 | `需要填写 demo Wi-Fi 名称` | M5Stack 固件 `wifiSsid`；传感器配置页面 |
| Wi-Fi 密码 | `需要填写 demo Wi-Fi 密码` | M5Stack 固件 `wifiPassword`；传感器配置页面 |
| 电脑局域网 IP | `需要重新校对该 Wi-Fi 下的电脑 IP` | M5Stack 固件 `ayellowHost`；传感器目标 IP |
| 传感器 UDP 端口 | 默认 `1399` | 传感器目标端口；ayellow 后端监听端口 |
| ayellow WebSocket 端口 | 默认 `8765` | M5Stack 固件 `ayellowPort`；HTML 预览 WebSocket 地址 |

不要把真实 Wi-Fi 密码提交到公开仓库。给朋友使用时，可以本地改固件里的 `wifiSsid` / `wifiPassword` 后再烧录。

端口号不是每台电脑自动不同：当前代码默认使用 UDP `1399` 接收传感器、WebSocket `8765` 广播状态。朋友需要校对的是三件事：传感器配置、ayellow 启动参数、M5Stack 固件是否使用同一组端口；如果她电脑上这些端口被其它程序占用，才需要一起改成新的端口。

## 3. 查电脑局域网 IP

Windows 上打开 PowerShell：

```powershell
ipconfig
```

找到当前 Wi-Fi 网卡下面的 IPv4 地址，例如：

```text
IPv4 地址 . . . . . . . . . . . . : 172.20.10.2
```

这个 IP 要填到：

- 两个 WT901 传感器的目标 IP。
- M5Stack 固件里的 `ayellowHost`。
- HTML 预览里的 `AYELLOW_GATEWAY_URL`，格式是 `ws://电脑IP:8765`。

## 4. 配置传感器

每个传感器都要配置成把数据发给电脑：

| 配置项 | 值 |
| --- | --- |
| Wi-Fi SSID | 和电脑、M5Stack 同一个 Wi-Fi |
| Wi-Fi password | 同一个 Wi-Fi 密码 |
| Protocol | UDP |
| Target IP | 电脑局域网 IP |
| Target port | `1399` |

配置后检查：

- 传感器、电脑、M5Stack 都在同一个 Wi-Fi。
- 两个传感器目标 IP 都是电脑 IP，不是 M5Stack IP。
- 目标端口是 `1399`。
- ayellow 前端中两个传感器显示在线并已绑定到 user1/user2。

## 5. 启动 ayellow 后端

在仓库根目录进入 backend：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m cycling_synth.server
```

后端启动后应该监听：

- UDP `1399`：接收传感器数据。
- WebSocket `8765`：给前端、HTML 预览、M5Stack 推送状态。

如果要换端口，启动后端时必须显式传参，并同步修改传感器和 M5Stack：

```powershell
python -m cycling_synth.server --udp-port 1399 --ws-port 8765
```

端口校对方法：

- 传感器 Target port 必须等于 `--udp-port`。
- M5Stack 固件 `ayellowPort` 必须等于 `--ws-port`。
- 前端和 HTML 预览连接的 WebSocket 端口也必须等于 `--ws-port`。
- 如果 Windows 防火墙弹窗，允许 Python / Node 在当前网络通信。

如果需要确认 WebSocket 是否有数据，可以用 Python 连接 `ws://127.0.0.1:8765` 看 payload，关键字段包括：

```json
{
  "riders": {
    "user1": { "cadenceRpm": 0 },
    "user2": { "cadenceRpm": 0 }
  },
  "animation": {
    "stage": 1,
    "progress": 0,
    "congratulations": "idle",
    "stage4Video": "idle"
  },
  "radiusMapping": {
    "minRpm": 0,
    "maxRpm": 15,
    "minRadius": 11,
    "maxRadius": 33
  }
}
```

## 6. 启动 ayellow 前端

进入前端目录：

```powershell
cd web
npm install
npm run dev -- --host 0.0.0.0
```

浏览器打开 Vite 显示的本机地址，通常是：

```text
http://localhost:5173
```

前端里重点检查：

- Gateway 是否 connected。
- 两个 sensor 是否 online。
- user1/user2 是否绑定到正确传感器。
- `cadenceRpm` 是否在传感器转动时实时变化。
- `M5Stack 球半径映射` 面板是否能调 `minRpm`、`maxRpm`、`minRadius`、`maxRadius`。
- 阶段进度和 stage 是否在挑战过程中变化。

## 7. M5Stack / M5StickS3 固件配置

固件项目在：

```text
m5stack_dual_balls/
```

关键配置在：

```text
m5stack_dual_balls/src/main.cpp
```

需要根据朋友电脑环境修改：

```cpp
const char *wifiSsid = "你的 Wi-Fi 名称";
const char *wifiPassword = "你的 Wi-Fi 密码";
const char *ayellowHost = "朋友电脑的局域网 IP";
const uint16_t ayellowPort = 8765;
```

PlatformIO 环境在：

```text
m5stack_dual_balls/platformio.ini
```

常用环境：

```text
m5stack-basic   # M5Stack Basic v2.7 / Core ESP32
m5stick-s3      # M5StickS3 小屏适配
```

烧录前用下面命令查看串口：

```powershell
python -m platformio device list
```

然后确认 `platformio.ini` 里的 `upload_port` 与实际串口一致，例如：

```ini
upload_port = COM9
```

## 8. 烧录 M5Stack Basic

```powershell
python -m platformio run -d m5stack_dual_balls -e m5stack-basic
python -m platformio run -d m5stack_dual_balls -e m5stack-basic -t upload
```

## 9. 烧录 M5StickS3

```powershell
python -m platformio run -d m5stack_dual_balls -e m5stick-s3
python -m platformio run -d m5stack_dual_balls -e m5stick-s3 -t upload
```

如果当前设备串口不是 `platformio.ini` 里的值，可以临时指定：

```powershell
python -m platformio run -d m5stack_dual_balls -e m5stick-s3 -t upload --upload-port COM9
```

## 10. M5Stack 显示逻辑

M5Stack 固件会从 ayellow WebSocket 接收：

- `payload.riders.user1.cadenceRpm`：映射到左边球半径。
- `payload.riders.user2.cadenceRpm`：映射到右边球半径。
- `payload.radiusMapping`：前端可动态调整 RPM→半径映射，不需要重新烧录。
- `payload.animation.stage`：同步阶段。
- `payload.animation.progress`：显示底部向上的满屏进度背景。
- `payload.animation.congratulations`：控制 congratulations 动画。
- `payload.animation.stage4Video`：第 4 阶段视频/fallback 动画。

M5Stack 上的 BtnA：重置 M5Stack 本地动画状态到第 1 阶段开始前。

## 11. 常见问题检查项

### 传感器在线但没有踏频

检查：

- 传感器是否真的在转动，不只是静止在线。
- 传感器目标 IP 是否是电脑 IP。
- 传感器目标端口是否是 `1399`。
- ayellow 后端是否正在运行。
- 前端里 user1/user2 是否绑定到了正确传感器。

### HTML / 前端有 RPM，但 M5Stack 球不变

检查：

- M5Stack 是否连上同一个 Wi-Fi。
- `ayellowHost` 是否是电脑当前局域网 IP。
- 电脑防火墙是否允许 `8765` WebSocket 连接。
- M5Stack 固件是否是最新版本。
- 前端 `radiusMapping` 是否设置合理，例如 `minRpm=0`、`maxRpm=15`、`minRadius=11`、`maxRadius=33`。

### M5Stack 一直显示第 4 阶段条纹/漩涡

检查 ayellow WebSocket 的 animation：

```json
{"stage": 1, "stage4Video": "idle"}
```

只有 `stage == 4` 且 `stage4Video == "playing"` 时，M5Stack 才应该显示第 4 阶段画面。

### 换 Wi-Fi 后全部失效

需要同步修改三处：

1. 电脑连接新 Wi-Fi。
2. 两个传感器重新配置 Wi-Fi 和目标电脑 IP。
3. M5Stack 固件里的 Wi-Fi 和 `ayellowHost` 改成新值后重新烧录。

### 端口是否要改

默认不用改。只有下面情况才改：

- `1399` 已被其它程序占用，导致 ayellow 后端无法启动 UDP 监听。
- `8765` 已被其它程序占用，导致 WebSocket 无法启动。
- 现场网络/防火墙规则要求使用其它端口。

如果改端口，必须成套修改：

| 改动 | 同步位置 |
| --- | --- |
| UDP 端口 | ayellow `--udp-port`；两个传感器 Target port |
| WebSocket 端口 | ayellow `--ws-port`；M5Stack `ayellowPort`；HTML / 前端 WebSocket 地址 |

## 12. Demo 前最终检查清单

- [ ] 电脑连到 demo Wi-Fi。
- [ ] 记录电脑 IPv4 地址。
- [ ] ayellow 后端启动，无报错。
- [ ] ayellow 前端打开，Gateway connected。
- [ ] 两个传感器配置为 UDP 到电脑 IP:1399，或配置到后端实际 `--udp-port`。
- [ ] M5Stack `ayellowPort` 等于后端实际 `--ws-port`。
- [ ] 前端显示两个传感器 online。
- [ ] 前端 user1/user2 踏频随转动实时变化。
- [ ] 前端 RPM→半径映射面板可调整。
- [ ] M5Stack / M5StickS3 固件里的 Wi-Fi、电脑 IP、端口正确。
- [ ] M5Stack / M5StickS3 已烧录最新固件。
- [ ] M5Stack 两个球会随 user1/user2 RPM 变化。
- [ ] 阶段进度背景会从下往上增长。
- [ ] 进入下一阶段时 congratulations 动画会触发。
- [ ] 进入第 4 阶段时显示第 4 阶段画面。
- [ ] BtnA 可以重置 M5Stack 本地动画状态。
