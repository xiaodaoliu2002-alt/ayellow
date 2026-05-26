# Good Time Cycling Synth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web preview where two WT901WIFI wheel sensors control a synthesized Good Time performance with synchronized reward layers.

**Architecture:** A Python UDP/WebSocket gateway parses sensor packets and computes rider cadence. A Vite React app connects to the gateway, manages rider configuration, and plays preprocessed Good Time event tables through Web Audio/Tone.js-style scheduling code. Shared behavior is split into small modules for later M5Stack migration.

**Tech Stack:** Python 3, WebSocket gateway, Vite, React, TypeScript, Vitest, Web Audio API.

---

## File Structure

- `docs/superpowers/specs/2026-05-26-good-time-cycling-synth-design.md`: confirmed design.
- `docs/superpowers/plans/2026-05-26-good-time-cycling-synth.md`: this implementation plan.
- `backend/cycling_synth/`: Python gateway package.
- `backend/tests/`: Python unit tests for packet parsing, cadence, binding, and sync-adjacent payloads.
- `web/src/`: React app, audio engine, sync state, rider configuration, and UI components.
- `web/src/**/*.test.ts`: TypeScript unit tests for cadence mapping, sync layers, and event scheduling.
- `processed/good-time/`: event-table manifest and generated/hand-authored track data.
- `scripts/`: preprocessing and utility scripts.

## Tasks

### Task 1: Project Scaffolding And Documentation

**Files:**
- Create: `package.json`
- Create: `web/index.html`
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/styles.css`
- Create: `backend/requirements.txt`
- Create: `backend/cycling_synth/__init__.py`

- [ ] Create the web and backend skeleton.
- [ ] Install frontend dependencies.
- [ ] Verify `npm run build` can compile the empty app.

### Task 2: Sensor Parsing And Cadence Core

**Files:**
- Create: `backend/cycling_synth/wit_frames.py`
- Create: `backend/cycling_synth/cadence.py`
- Create: `backend/tests/test_wit_frames.py`
- Create: `backend/tests/test_cadence.py`

- [ ] Write parser tests for `0x55` gyro frames and SDK-style `WT...` 54-byte packets.
- [ ] Run parser tests and confirm they fail before implementation.
- [ ] Implement packet parsing into structured samples with gyro, acceleration, angle, battery, and RSSI where available.
- [ ] Write cadence tests for wheel RPM, cadence RPM, clamping, smoothing, and stale status.
- [ ] Run cadence tests and confirm they fail before implementation.
- [ ] Implement cadence calculation and rider sensor state.
- [ ] Verify Python tests pass.

### Task 3: Gateway And WebSocket Stream

**Files:**
- Create: `backend/cycling_synth/gateway.py`
- Create: `backend/cycling_synth/config.py`
- Create: `backend/cycling_synth/server.py`
- Create: `backend/tests/test_gateway_state.py`

- [ ] Write tests for fixed IP binding, discovered unbound sensors, rider parameter updates, and JSON state payloads.
- [ ] Run tests and confirm they fail before implementation.
- [ ] Implement UDP receive loop, state manager, and WebSocket broadcast loop.
- [ ] Add a command to run the gateway on UDP `1399` and WebSocket `8765`.
- [ ] Verify backend tests pass.

### Task 4: Event Tables For Good Time

**Files:**
- Create: `processed/good-time/manifest.json`
- Create: `processed/good-time/tracks/bass.json`
- Create: `processed/good-time/tracks/lead.json`
- Create: `processed/good-time/tracks/drums.json`
- Create: `processed/good-time/tracks/piano.json`
- Create: `processed/good-time/tracks/guitar.json`
- Create: `processed/good-time/tracks/pad.json`
- Create: `scripts/generate_good_time_events.mjs`
- Create: `web/src/music/types.ts`
- Create: `web/src/music/loadSong.ts`

- [ ] Generate a compact, loopable first-pass event arrangement that follows the Good Time role design.
- [ ] Add a loader that validates manifest and track event shapes.
- [ ] Verify the loader can import the Good Time manifest during web tests.

### Task 5: Mapping And Sync State

**Files:**
- Create: `web/src/core/cadenceMapping.ts`
- Create: `web/src/core/syncState.ts`
- Create: `web/src/core/cadenceMapping.test.ts`
- Create: `web/src/core/syncState.test.ts`

- [ ] Write mapping tests for baseline cadence, clamped tempo ratio, and invalid cadence.
- [ ] Run mapping tests and confirm they fail before implementation.
- [ ] Implement cadence-to-BPM mapping.
- [ ] Write sync tests for 30s/90s/150s/210s unlocks and fade-back behavior.
- [ ] Run sync tests and confirm they fail before implementation.
- [ ] Implement sync state and layer volume model.
- [ ] Verify web tests pass.

### Task 6: Browser Audio Engine

**Files:**
- Create: `web/src/audio/synths.ts`
- Create: `web/src/audio/engine.ts`
- Create: `web/src/audio/scheduler.ts`
- Create: `web/src/audio/types.ts`

- [ ] Implement lightweight Web Audio synth voices for bass, lead, drums, piano, pluck, pad, and cue.
- [ ] Implement event scheduling from beat-based event tables using per-track BPM.
- [ ] Expose start, stop, updateTrackBpm, updateLayerVolumes, and playCue.
- [ ] Keep audio unlocked behind a user click.

### Task 7: Web Control Console

**Files:**
- Create: `web/src/api/gatewayClient.ts`
- Create: `web/src/components/RiderPanel.tsx`
- Create: `web/src/components/SyncPanel.tsx`
- Create: `web/src/components/TrackLayers.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`

- [ ] Implement WebSocket gateway client.
- [ ] Implement fixed IP and gear-ratio controls for both riders.
- [ ] Implement discovered sensor display.
- [ ] Wire rider state into BPM mapping, audio engine updates, and sync layer updates.
- [ ] Style the control console for a hardware demo.

### Task 8: Verification

**Files:**
- Modify as needed based on verification results.

- [ ] Run Python tests.
- [ ] Run web tests.
- [ ] Build the web app.
- [ ] Start the gateway and web dev server.
- [ ] Open the local page in the browser and verify it loads without console errors.
- [ ] Verify the audio start control initializes the engine without throwing.
- [ ] Document run commands and remaining hardware-only checks.
