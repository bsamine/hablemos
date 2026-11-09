"use client";

/** Mic → 16 kHz PCM chunks, and 24 kHz PCM playback queue, on one AudioContext. */
export class AudioIO {
  ctx: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private nextTime = 0;
  private playing = new Set<AudioBufferSourceNode>();
  muted = false;
  onLevel?: (speaking: boolean) => void;

  constructor() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
  }

  async start(onChunk: (b64: string) => void) {
    await this.ctx.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    await this.ctx.audioWorklet.addModule("/pcm-recorder.js");
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "pcm-recorder");
    this.node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.muted) return;
      onChunk(bufToB64(e.data));
    };
    src.connect(this.node);
    // Keep the worklet pulled by the graph without sending mic audio to the speakers.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.node.connect(sink).connect(this.ctx.destination);
  }

  /** Queue base64 PCM16 (24 kHz) from Gemini for gapless playback. */
  play(b64: string, rate = 24000) {
    const bytes = b64ToBytes(b64);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    if (!pcm.length) return;
    const buf = this.ctx.createBuffer(1, pcm.length, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const t = Math.max(this.ctx.currentTime + 0.03, this.nextTime);
    src.start(t);
    this.nextTime = t + buf.duration;
    this.playing.add(src);
    this.onLevel?.(true);
    src.onended = () => {
      this.playing.delete(src);
      if (!this.playing.size) this.onLevel?.(false);
    };
  }

  /** The learner interrupted: drop whatever the tutor was still saying. */
  stopPlayback() {
    for (const s of this.playing) {
      try {
        s.stop();
      } catch {}
    }
    this.playing.clear();
    this.nextTime = 0;
    this.onLevel?.(false);
  }

  async close() {
    this.stopPlayback();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    try {
      await this.ctx.close();
    } catch {}
  }
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

let current: HTMLAudioElement | null = null;

/** Stop whatever Carla is currently saying. */
export function stopSpeaking() {
  current?.pause();
  current = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/**
 * Carla says a Spanish text (Gemini TTS, cached on the server). `rate` applies instantly.
 * Falls back to a female device voice if the server voice is unavailable.
 */
export function speakEs(text: string, rate = 1): HTMLAudioElement | null {
  if (typeof window === "undefined" || !text) return null;
  stopSpeaking();
  const a = new Audio(`/api/tts?t=${encodeURIComponent(text)}`);
  a.playbackRate = rate;
  a.preservesPitch = true;
  current = a;
  let started = false;
  a.addEventListener("playing", () => (started = true), { once: true });
  const fallback = () => {
    if (started || current !== a) return;
    current = null;
    deviceSpeak(text, rate);
  };
  a.addEventListener("error", fallback, { once: true });
  setTimeout(fallback, 12_000);
  a.play().catch(fallback);
  return a;
}

const MALE = /jorge|diego|juan|carlos|pablo|enrique|miguel|andr[eé]s|male|hombre/i;

function deviceSpeak(text: string, rate: number) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = Math.max(0.6, Math.min(1.2, rate * 0.9));
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("es"));
  const v =
    voices.find((x) => x.lang === "es-ES" && /m[oó]nica|paulina|marisol|elvira|helena|female|mujer/i.test(x.name)) ??
    voices.find((x) => x.lang === "es-ES" && !MALE.test(x.name)) ??
    voices.find((x) => !MALE.test(x.name));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}
