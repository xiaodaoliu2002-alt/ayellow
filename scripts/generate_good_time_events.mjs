import { mkdir, writeFile } from "node:fs/promises";

const outDir = new URL("../processed/good-time/", import.meta.url);
const tracksDir = new URL("./tracks/", outDir);
const loopBeats = 32;

const manifest = {
  id: "good-time",
  title: "Good Time",
  artist: "Owl City & Carly Rae Jepsen",
  baseBpm: 126,
  loopBeats,
  trackOrder: ["bass", "lead", "drums", "piano", "guitar", "pad"],
  tracks: [
    { id: "bass", name: "Rider 1 Bass", role: "base", synth: "bass", path: "tracks/bass.json" },
    { id: "lead", name: "Rider 2 Lead", role: "base", synth: "lead", path: "tracks/lead.json" },
    { id: "drums", name: "Sync Drums", role: "reward", synth: "drums", path: "tracks/drums.json" },
    { id: "piano", name: "Sync Piano", role: "reward", synth: "piano", path: "tracks/piano.json" },
    { id: "guitar", name: "Sync Pluck", role: "reward", synth: "pluck", path: "tracks/guitar.json" },
    { id: "pad", name: "Sync Pad", role: "reward", synth: "pad", path: "tracks/pad.json" }
  ]
};

const event = (beat, duration, note, velocity, extra = {}) => ({ beat, duration, note, velocity, ...extra });

function bassEvents() {
  const roots = [36, 43, 45, 41];
  const events = [];
  for (let bar = 0; bar < 8; bar += 1) {
    const root = roots[bar % roots.length];
    const base = bar * 4;
    events.push(event(base, 0.75, root, 0.86));
    events.push(event(base + 1, 0.5, root + 7, 0.66));
    events.push(event(base + 2, 0.75, root, 0.8));
    events.push(event(base + 3, 0.5, root + 12, 0.62));
  }
  return events;
}

function leadEvents() {
  const phrase = [
    [0, 0.5, 68], [0.5, 0.5, 71], [1, 0.5, 73], [1.5, 0.5, 75],
    [2, 0.75, 76], [3, 0.5, 75], [3.5, 0.5, 73],
    [4, 0.5, 71], [4.5, 0.5, 73], [5, 0.5, 75], [5.5, 0.5, 76],
    [6, 1, 78], [7, 0.5, 76], [7.5, 0.5, 75]
  ];
  const events = [];
  for (let repeat = 0; repeat < 4; repeat += 1) {
    for (const [beat, duration, note] of phrase) {
      events.push(event(beat + repeat * 8, duration, note, 0.72));
    }
  }
  return events;
}

function drumEvents() {
  const events = [];
  for (let beat = 0; beat < loopBeats; beat += 1) {
    events.push(event(beat, 0.12, 36, beat % 4 === 0 ? 0.95 : 0.7, { drum: "kick" }));
    events.push(event(beat + 0.5, 0.08, 42, 0.34, { drum: "hat" }));
    if (beat % 4 === 1 || beat % 4 === 3) {
      events.push(event(beat, 0.12, 38, 0.82, { drum: "snare" }));
    }
  }
  return events;
}

function pianoEvents() {
  const chords = [
    [60, 64, 67],
    [55, 59, 62],
    [57, 60, 64],
    [53, 57, 60]
  ];
  const events = [];
  for (let bar = 0; bar < 8; bar += 1) {
    const chord = chords[bar % chords.length];
    const base = bar * 4;
    for (const note of chord) {
      events.push(event(base, 1.5, note, 0.42));
      events.push(event(base + 2, 1.25, note + 12, 0.34));
    }
  }
  return events;
}

function guitarEvents() {
  const notes = [72, 76, 79, 83, 79, 76, 74, 71];
  const events = [];
  for (let beat = 0; beat < loopBeats; beat += 0.5) {
    events.push(event(beat, 0.2, notes[(beat * 2) % notes.length], 0.38));
  }
  return events;
}

function padEvents() {
  const chords = [
    [48, 55, 60, 64],
    [43, 50, 55, 59],
    [45, 52, 57, 60],
    [41, 48, 53, 57]
  ];
  const events = [];
  for (let bar = 0; bar < 8; bar += 1) {
    for (const note of chords[bar % chords.length]) {
      events.push(event(bar * 4, 3.75, note, 0.3));
    }
  }
  return events;
}

const trackData = {
  bass: bassEvents(),
  lead: leadEvents(),
  drums: drumEvents(),
  piano: pianoEvents(),
  guitar: guitarEvents(),
  pad: padEvents()
};

await mkdir(tracksDir, { recursive: true });
await writeFile(new URL("./manifest.json", outDir), JSON.stringify(manifest, null, 2));
for (const track of manifest.tracks) {
  await writeFile(
    new URL(track.path, outDir),
    JSON.stringify({ ...track, loopBeats, events: trackData[track.id] }, null, 2)
  );
}
