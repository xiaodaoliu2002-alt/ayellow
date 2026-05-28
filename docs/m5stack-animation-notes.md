# M5Stack Animation Notes

Stable audio baseline:

- Tag: `audio-stable-2026-05-28`
- Commit: `06241bb Use cue assets and split guide BPM controls`

Development branch:

- `m5stack-animation`

Source logic to reuse:

- `backend/cycling_synth/wit_frames.py`: WIT sensor frame parsing
- `backend/cycling_synth/cadence.py`: gyro-to-cadence mapping
- `web/src/core/cadenceMapping.ts`: cadence-to-playback intensity mapping
- `web/src/core/syncState.ts`: two-rider sync detection
- `web/src/core/challengeState.ts`: staged challenge progression

Protection rule:

- Do not change browser audio playback while developing the M5Stack animation path unless explicitly required.
- Prefer adding relay and firmware code in `tools/` and `firmware/m5stack-animation/`.
