# Good Time Cycling Synth Design

## Goal

Build a browser-based preview system where two riders use wheel-mounted WT901WIFI posture sensors to control two musical tracks from a synthesized reinterpretation of Owl City - Good Time. The first version should use only real sensor input, not simulated sliders, and should make the full interaction loop audible before later M5Stack migration work.

## Confirmed Scope

- Song: `music/Owl City - Good Time_stems_mp3/`
- Riders: two riders, two bicycles, one wheel-mounted sensor per bicycle
- User 1 base track: bass
- User 2 base track: vocals reinterpreted as lead synth
- Reward tracks: drums, piano, guitar/pluck, pad/other
- Musical style: preserve the recognizable bass and melody, while allowing drums, pad, and guitar/pluck to be reworked for a better interactive experience
- Sensor binding: fixed IP per user, with unbound sensor IPs shown in the web UI
- First version: real sensors only; no simulated cadence controls

## System Architecture

```text
WT901WIFI sensors on two wheels
  -> UDP packets
  -> Python sensor gateway
  -> WIT frame parsing
  -> rider binding by IP
  -> gyro preprocessing, wheel RPM, cadence RPM
  -> WebSocket state stream
  -> React web app
  -> Good Time event-table player and browser synth
  -> live audio output
```

The Python side extends the existing receiver approach and uses the bundled `901WIFI_python_sdk` as protocol reference. It must support the observed standard `0x55` WIT frames and the SDK-style `WT...` 54-byte frames so the app can tolerate both configured packet modes.

The web side owns the performance UI, track status, Web Audio synthesis, layer unlock state, and local configuration editing.

## Sensor Processing

Each rider has independent state:

- sensor IP
- connection status
- gyro x/y/z
- selected rotation axis
- gyro bias
- front chainring teeth
- rear sprocket teeth
- wheel RPM
- cadence RPM
- mapped track BPM
- confidence and stale-data status

Cadence is calculated from the wheel gyro axis:

```text
wheel_rpm = abs(gyro_axis_deg_per_sec - gyro_bias) / 360 * 60
cadence_rpm = wheel_rpm * rear_teeth / front_teeth
```

Defaults:

- front chainring: 42 teeth
- rear sprocket: 16 teeth
- baseline cadence: 80 rpm
- valid cadence range: 30-140 rpm
- sensor stale threshold: 3 seconds
- default smoothing: about 1-2 seconds

Calibration has two modes:

- Still calibration: sample a stationary wheel for about two seconds and store gyro bias.
- Axis calibration: compare gyro energy across X/Y/Z while the rider spins the wheel, then select the strongest axis. The UI also allows manual axis selection.

Acceleration and angle values are displayed or retained for diagnostics, but gyro is the first-version source of cadence because it maps most directly to wheel rotation.

## Mapping

Cadence controls the user's track speed relative to the song's base tempo, not as an absolute BPM:

```text
cadence_ratio = cadence_rpm / baseline_cadence_rpm
track_bpm = song_base_bpm * clamp(cadence_ratio, 0.75, 1.25)
```

This keeps the music playable across realistic riding cadences while still making effort audible.

## Synchronization And Rewards

The base state always includes:

- user 1 bass
- user 2 lead

Synchronization requires:

- both sensors online
- both cadences in valid range
- tempo difference within about 4 percent
- beat phase difference within about 1/8 beat

Reward stages:

```text
0s synced: bass + lead
30s synced: add drums and play cue
90s synced: add piano and play cue
150s synced: add guitar/pluck and play cue
210s synced: add pad/other and play cue
```

If synchronization breaks, reward tracks fade down over about 20-30 seconds, stepping back toward the base two-track state. Cue sounds are synthesized rather than loaded from samples, so the behavior can later move to M5Stack.

## Audio Preprocessing

The source stems are:

- `bass.mp3`
- `drums.mp3`
- `guitar.mp3`
- `other.mp3`
- `piano.mp3`
- `vocals.mp3`

The browser player consumes event tables, not the source MP3 files:

```text
processed/good-time/manifest.json
processed/good-time/tracks/bass.json
processed/good-time/tracks/lead.json
processed/good-time/tracks/drums.json
processed/good-time/tracks/piano.json
processed/good-time/tracks/guitar.json
processed/good-time/tracks/pad.json
```

The initial development version may include hand-authored or rule-generated event tables to get the interaction loop running. The preprocessing script should create the same file shape and can later be upgraded to use Basic Pitch for melodic stems and onset detection for drums.

Track roles:

- bass: monophonic synth bass that preserves the low-end movement
- lead: vocals-derived melody, performed by a bright synth lead
- drums: electronic kick/snare/hat pattern, first reward layer
- piano: quantized EP/FM pattern, second reward layer
- guitar: pluck/arp pattern, third reward layer
- pad: sustained harmony/texture, final reward layer

## Web UI

The interface is a live control console, not a marketing page.

Expected areas:

- global header with song name, gateway status, audio start/stop
- user 1 and user 2 panels with IP binding, chainring/sprocket values, calibration controls, cadence, BPM, and confidence
- sync panel with current stage, next unlock countdown, tempo delta, phase delta, and reason when not synced
- track layer strip showing base and reward layers with current volume/activity
- unbound sensor area listing discovered sensor IPs

The UI should be quiet, dense, and usable during a hardware demo.

## Hardware Migration Notes

Computer-side responsibilities:

- audio-to-event preprocessing
- web UI
- development diagnostics

Portable responsibilities:

- sensor parsing
- cadence calculation
- BPM mapping
- synchronization state machine
- event-table playback logic

M5Stack phase should read the preprocessed song event data from SD card, flash filesystem, or compiled arrays. The first version stores JSON for clarity; the hardware version can convert the same events to compact integer tuples such as:

```text
track_id, beat_tick, duration_tick, midi_note, velocity
```

This lets the computer "make the score" and the hardware "perform the score."

## First-Version Acceptance Criteria

- A web page runs locally and can start browser audio after user interaction.
- A Python gateway can receive sensor UDP packets and stream rider state to the web page.
- The web page supports fixed IP binding for two riders and shows discovered unbound sensor IPs.
- Cadence is calculated from gyro readings and rider gear ratio.
- Good Time event tables load and play as synthesized bass and lead base tracks.
- Reward tracks unlock after sustained synchronization and fade out when synchronization breaks.
- The same event table files are clearly separated from the web UI so they can be reused for hardware migration.
