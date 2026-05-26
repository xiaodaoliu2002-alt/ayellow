import type { NoteEvent, SynthType } from "../music/types";

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function envelopeGain(
  context: AudioContext,
  destination: AudioNode,
  startTime: number,
  duration: number,
  velocity: number,
  attack = 0.01,
  release = 0.08,
): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity), startTime + attack);
  gain.gain.setValueAtTime(Math.max(0.0001, velocity), startTime + Math.max(attack, duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  gain.connect(destination);
  return gain;
}

function tone(
  context: AudioContext,
  destination: AudioNode,
  note: number,
  startTime: number,
  duration: number,
  velocity: number,
  type: OscillatorType,
  filterFrequency?: number,
): void {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(midiToFrequency(note), startTime);
  const gain = envelopeGain(context, destination, startTime, duration, velocity);

  if (filterFrequency) {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrequency, startTime);
    oscillator.connect(filter);
    filter.connect(gain);
  } else {
    oscillator.connect(gain);
  }

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.05);
}

function noise(context: AudioContext, destination: AudioNode, startTime: number, duration: number, velocity: number): void {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(2500, startTime);
  const gain = envelopeGain(context, destination, startTime, duration, velocity, 0.002, 0.04);
  source.connect(filter);
  filter.connect(gain);
  source.start(startTime);
}

function drum(context: AudioContext, destination: AudioNode, event: NoteEvent, startTime: number): void {
  if (event.drum === "kick") {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(115, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(45, startTime + 0.12);
    const gain = envelopeGain(context, destination, startTime, 0.18, event.velocity, 0.002, 0.1);
    oscillator.connect(gain);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
    return;
  }

  if (event.drum === "snare") {
    noise(context, destination, startTime, 0.16, event.velocity * 0.8);
    tone(context, destination, 50, startTime, 0.12, event.velocity * 0.35, "triangle", 900);
    return;
  }

  noise(context, destination, startTime, 0.05, event.velocity * 0.55);
}

export function playSynthEvent(
  context: AudioContext,
  destination: AudioNode,
  synth: SynthType,
  event: NoteEvent,
  startTime: number,
  secondsPerBeat: number,
): void {
  const duration = Math.max(0.04, event.duration * secondsPerBeat);
  const velocity = Math.max(0.0001, Math.min(1, event.velocity));

  if (synth === "drums") {
    drum(context, destination, event, startTime);
  } else if (synth === "bass") {
    tone(context, destination, event.note, startTime, duration * 0.92, velocity * 0.72, "sawtooth", 380);
  } else if (synth === "lead") {
    tone(context, destination, event.note, startTime, duration * 0.88, velocity * 0.42, "square", 1800);
  } else if (synth === "piano") {
    tone(context, destination, event.note, startTime, duration * 0.75, velocity * 0.34, "triangle", 2400);
  } else if (synth === "pluck") {
    tone(context, destination, event.note, startTime, Math.min(duration, 0.14), velocity * 0.28, "sawtooth", 3200);
  } else {
    tone(context, destination, event.note, startTime, duration, velocity * 0.2, "sine", 1200);
  }
}

export function playCue(context: AudioContext, destination: AudioNode): void {
  const now = context.currentTime + 0.02;
  tone(context, destination, 84, now, 0.12, 0.42, "triangle", 3600);
  tone(context, destination, 91, now + 0.12, 0.18, 0.38, "triangle", 4200);
}
