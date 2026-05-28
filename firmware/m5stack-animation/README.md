# M5Stack Animation Firmware

This folder is reserved for the M5Stack Basic v2.7 animation target.

The current project keeps browser audio playback stable on `main` and develops the embedded animation work on the `m5stack-animation` branch. The first implementation target is:

1. Keep the existing computer-side sensor gateway and browser audio flow unchanged.
2. Add a small computer-side relay that can forward simplified rider/challenge state to M5Stack.
3. Render animations on the M5Stack display from that simplified state.
4. Move more sensor processing onto M5Stack only after the animation behavior is stable.

## Development

Install PlatformIO, then build from this directory:

```sh
pio run
```

Upload after connecting the M5Stack Basic v2.7 by USB-C:

```sh
pio run --target upload
```

The current firmware is a minimal boot screen placeholder. The animation state protocol and rendering logic will be added after the animation behavior is specified.
