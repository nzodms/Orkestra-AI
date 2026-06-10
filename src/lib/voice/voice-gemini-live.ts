/* eslint-disable @typescript-eslint/no-explicit-any */
// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — runtime Gemini Live (WebSocket), côté navigateur.
// Token éphémère via /api/voice/gemini-live/session (jamais la clé). Micro PCM
// 16 kHz → WS Gemini → audio 24 kHz joué en direct + function calling (outils
// Orkestra). Logs de diagnostic détaillés + onDiag pour le bloc debug.
// ──────────────────────────────────────────────────────────────────────────

import { vlog } from "./voice-orchestrator";
import { REALTIME_INSTRUCTIONS, GEMINI_FUNCTION_DECLARATIONS } from "./voice-realtime-tools";
import type { RealtimeCallbacks, RealtimeHandle } from "./voice-realtime";

const WS_BASE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

function floatToPCM16Bytes(f32: Float32Array): Uint8Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) { const s = Math.max(-1, Math.min(1, f32[i])); i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
  return new Uint8Array(i16.buffer);
}
function bytesToBase64(bytes: Uint8Array): string { let bin = ""; const c = 0x8000; for (let i = 0; i < bytes.length; i += c) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + c) as unknown as number[]); return btoa(bin); }
function base64ToFloat32(b64: string): Float32Array { const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); const i16 = new Int16Array(bytes.buffer); const f = new Float32Array(i16.length); for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 0x8000; return f; }

/** Démarre une session Gemini Live. Rejette avec un message de RAISON précis si échec. */
export async function startGeminiLiveSession(cb: RealtimeCallbacks): Promise<RealtimeHandle> {
  const diag = cb.onDiag || (() => {});
  if (typeof window === "undefined" || !window.WebSocket || !navigator.mediaDevices) throw new Error("navigateur incompatible");
  cb.onStatus("connecting");

  // 1) Token éphémère (serveur).
  vlog("gemini-live-session-start");
  const sres = await fetch("/api/voice/gemini-live/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyRefs: { gemini: cb.keyRefs.gemini } }) });
  const sdata = await sres.json().catch(() => ({}));
  if (!sdata.ok || !sdata.token) {
    vlog("gemini-live-error", { stage: "session", reason: sdata.reason || "no-token" });
    diag({ lastError: `session: ${sdata.reason || "no-token"}` });
    cb.onError(sdata.error || "Gemini Live indisponible.");
    throw new Error(`token: ${sdata.reason || "no-token"}`);
  }
  vlog("gemini-live-session-ok");
  const token: string = sdata.token;
  const model: string = sdata.model || "gemini-2.0-flash-live-001";

  // 2) Micro.
  let mic: MediaStream;
  try { mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
  catch { vlog("gemini-live-error", { stage: "mic", reason: "permission" }); diag({ lastError: "micro refusé" }); cb.onError("Micro refusé. Autorisez le microphone."); throw new Error("micro: permission refusée"); }
  vlog("gemini-live-mic-permission-ok"); diag({ mic: true });

  // 3) WebSocket.
  vlog("gemini-live-ws-connect-start");
  const ws = new WebSocket(`${WS_BASE}?key=${encodeURIComponent(token)}`);
  let muted = false, userTxt = "", asstTxt = "";
  let firstChunk = true, firstMsg = true, firstAudio = true, chunkCount = 0, msgCount = 0;

  const InCtx: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
  const inputCtx = new InCtx({ sampleRate: 16000 });
  const outputCtx = new InCtx({ sampleRate: 24000 });
  const sink = inputCtx.createGain(); sink.gain.value = 0; sink.connect(inputCtx.destination);
  let proc: ScriptProcessorNode | null = null;
  const playing = new Set<AudioBufferSourceNode>();
  let playHead = 0;
  function enqueueAudio(b64: string) {
    const f32 = base64ToFloat32(b64); if (!f32.length) return;
    const buf = outputCtx.createBuffer(1, f32.length, 24000); buf.getChannelData(0).set(f32);
    const node = outputCtx.createBufferSource(); node.buffer = buf; node.connect(outputCtx.destination);
    const t = Math.max(outputCtx.currentTime, playHead); node.start(t); playHead = t + buf.duration;
    playing.add(node); node.onended = () => playing.delete(node);
    if (firstAudio) { firstAudio = false; vlog("gemini-live-audio-play-start"); }
    cb.onStatus("speaking");
  }
  function clearAudio() { playing.forEach((n) => { try { n.stop(); } catch { /* */ } }); playing.clear(); playHead = outputCtx.currentTime; }
  function startMic() {
    const src = inputCtx.createMediaStreamSource(mic);
    proc = inputCtx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) => {
      if (muted || ws.readyState !== WebSocket.OPEN) return;
      const data = bytesToBase64(floatToPCM16Bytes(e.inputBuffer.getChannelData(0)));
      try { ws.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data }] } })); chunkCount++; if (firstChunk) { firstChunk = false; vlog("gemini-live-audio-chunk-sent"); } if (chunkCount % 50 === 0) diag({ chunks: chunkCount }); diag({ audioIn: true }); } catch { /* */ }
    };
    src.connect(proc); proc.connect(sink);
    vlog("gemini-live-audio-capture-start"); diag({ audioIn: true });
  }

  ws.onopen = () => {
    vlog("gemini-live-ws-connected"); diag({ ws: true });
    ws.send(JSON.stringify({
      setup: {
        model: `models/${model}`,
        generationConfig: { responseModalities: ["AUDIO"] },
        systemInstruction: { parts: [{ text: REALTIME_INSTRUCTIONS }] },
        tools: [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    }));
    vlog("gemini-live-setup-sent");
  };
  ws.onmessage = async (ev) => {
    let raw = ev.data as any; if (raw instanceof Blob) raw = await raw.text();
    let msg: any; try { msg = JSON.parse(raw); } catch { return; }
    msgCount++; if (firstMsg) { firstMsg = false; vlog("gemini-live-server-message-received", { keys: Object.keys(msg).join(",") }); } diag({ messages: msgCount });

    if (msg.setupComplete) { startMic(); cb.onStatus("listening"); return; }
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) clearAudio();
      if (sc.inputTranscription?.text) { userTxt += sc.inputTranscription.text; cb.onUserTranscript(userTxt.trim()); }
      if (sc.outputTranscription?.text) { asstTxt += sc.outputTranscription.text; cb.onAssistantText(asstTxt.trim()); }
      for (const p of (sc.modelTurn?.parts || [])) {
        if (p.inlineData?.data) { if (firstAudio) vlog("gemini-live-audio-output-received"); diag({ audioOut: true }); enqueueAudio(p.inlineData.data); }
        else if (p.text) { asstTxt += p.text; cb.onAssistantText(asstTxt.trim()); }
      }
      if (sc.turnComplete) { userTxt = ""; asstTxt = ""; cb.onStatus("listening"); }
      return;
    }
    if (msg.toolCall?.functionCalls?.length) {
      cb.onStatus("tool");
      const responses: any[] = [];
      for (const fc of msg.toolCall.functionCalls) {
        vlog("gemini-live-tool-call", { name: fc.name });
        let out = ""; try { out = await cb.onToolCall(String(fc.name), fc.args || {}); } catch { out = "Erreur."; }
        responses.push({ id: fc.id, name: fc.name, response: { result: out } });
      }
      try { ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } })); } catch { /* */ }
    }
  };
  ws.onerror = () => { vlog("gemini-live-error", { stage: "ws", reason: "error" }); diag({ lastError: "websocket: erreur" }); };
  ws.onclose = (e) => { vlog("gemini-live-error", { stage: "ws-close", code: e.code, reason: e.reason || "" }); if (e.code !== 1000) { diag({ ws: false, lastError: `ws fermé (code ${e.code}${e.reason ? " " + e.reason : ""})` }); cb.onError(`Connexion Gemini Live fermée (code ${e.code}).`); } cb.onStatus("closed"); };

  function cleanup() {
    vlog("gemini-live-stop");
    try { ws.close(); } catch { /* */ }
    try { proc?.disconnect(); } catch { /* */ }
    mic.getTracks().forEach((t) => t.stop()); clearAudio();
    try { inputCtx.close(); } catch { /* */ } try { outputCtx.close(); } catch { /* */ }
  }
  return {
    stop: () => cleanup(),
    interrupt: () => { vlog("gemini-live-interrupt"); clearAudio(); },
    setMuted: (m: boolean) => { muted = m; mic.getAudioTracks().forEach((t) => { t.enabled = !m; }); },
  };
}
