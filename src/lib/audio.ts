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

  /** False once iOS has taken the microphone away (call, Siri, app in background). */
  micAlive(): boolean {
    return !!this.stream?.getAudioTracks().some((t) => t.readyState === "live" && t.enabled);
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
      } catch {
        /* already stopped */
      }
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
    } catch {
      /* already closed */
    }
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

export type SpeakState = "loading" | "playing" | "idle";
type Speaker = { audio: HTMLAudioElement | null; onState?: (s: SpeakState) => void; cancelled: boolean };
let current: Speaker | null = null;

/** Stop whatever Carla is currently saying. */
export function stopSpeaking() {
  const c = current;
  current = null;
  if (c) {
    c.cancelled = true;
    if (c.audio) {
      c.audio.pause();
      c.audio.removeAttribute("src");
      c.audio.load();
    }
    c.onState?.("idle");
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Very small language guess for texts that mix nothing: French has its own letters and words. */
export function guessLang(text: string): "es" | "fr" {
  if (/[¿¡ñ]/i.test(text)) return "es";
  if (/[àâçèêëîïôœùûÿ]|\b(je|tu|nous|vous|les|des|est|une|avec|pour|dans|c'est|qu'|l'|d')\b/i.test(text)) return "fr";
  return "es";
}

/**
 * Carla says a text with Gemini TTS (cached on the server), in Spanish (Castilian accent) or French
 * (native French accent). `onState` drives the ▶ button. The server voice is waited for up to 30 s
 * (first generation can be slow); only if it fails does a device voice read the text — never both.
 */
export function speak(
  text: string,
  opts: { lang?: "es" | "fr"; rate?: number; onState?: (s: SpeakState) => void } = {},
): HTMLAudioElement | null {
  if (typeof window === "undefined" || !text) return null;
  stopSpeaking();
  const lang = opts.lang ?? guessLang(text);
  const rate = opts.rate ?? 1;
  const a = new Audio(`/api/tts?lang=${lang}&t=${encodeURIComponent(text)}`);
  a.playbackRate = rate;
  a.preservesPitch = true;
  const me: Speaker = { audio: a, onState: opts.onState, cancelled: false };
  current = me;
  opts.onState?.("loading");
  let started = false;
  const done = () => {
    if (current === me) current = null;
    if (!me.cancelled) opts.onState?.("idle");
  };
  a.addEventListener("playing", () => {
    started = true;
    if (!me.cancelled) opts.onState?.("playing");
  });
  a.addEventListener("ended", done, { once: true });
  const fallback = (why: string) => {
    if (started || me.cancelled || current !== me) return;
    console.warn("server voice unavailable, using the device voice:", why);
    me.cancelled = true; // the server audio must not start later on top of the device voice
    a.pause();
    a.removeAttribute("src");
    me.audio = null;
    deviceSpeak(text, rate, lang, () => {
      if (current === me) current = null;
      opts.onState?.("idle");
    });
    opts.onState?.("playing");
  };
  a.addEventListener("error", () => fallback("error"), { once: true });
  const timer = setTimeout(() => fallback("timeout"), 30_000);
  a.addEventListener("playing", () => clearTimeout(timer), { once: true });
  a.play().catch((e: unknown) => {
    if (e instanceof DOMException && e.name === "AbortError") return; // replaced by another ▶
    fallback(String(e));
  });
  return a;
}

/** Kept for existing callers: Spanish by default. */
export function speakEs(text: string, rate = 1): HTMLAudioElement | null {
  return speak(text, { lang: "es", rate });
}

const MALE = /jorge|diego|juan|carlos|pablo|enrique|miguel|andr[eé]s|male|hombre/i;

function deviceSpeak(text: string, rate: number, lang: "es" | "fr" = "es", onEnd?: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const tag = lang === "fr" ? "fr-FR" : "es-ES";
  u.lang = tag;
  u.rate = Math.max(0.6, Math.min(1.2, rate * 0.9));
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith(lang));
  const female = lang === "fr" ? /am[eé]lie|audrey|marie|aurelie|female|femme/i : /m[oó]nica|paulina|marisol|elvira|helena|female|mujer/i;
  const v =
    voices.find((x) => x.lang === tag && female.test(x.name)) ??
    voices.find((x) => x.lang === tag && !MALE.test(x.name)) ??
    voices.find((x) => !MALE.test(x.name));
  if (v) u.voice = v;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}
