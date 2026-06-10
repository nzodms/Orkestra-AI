/* eslint-disable @typescript-eslint/no-explicit-any */
// ──────────────────────────────────────────────────────────────────────────
// Orkestra Voice — runtime OpenAI Realtime (WebRTC), côté navigateur.
// Token éphémère via /api/voice/realtime/session (jamais la clé). Flux micro →
// OpenAI → audio assistant + tool calling (outils Orkestra). Interruption + mute.
// Repli texte si indisponible. Aucune clé loggée.
// ──────────────────────────────────────────────────────────────────────────

import { vlog } from "./voice-orchestrator";
import { REALTIME_INSTRUCTIONS, REALTIME_TOOLS } from "./voice-realtime-tools";

export type RealtimeStatus = "connecting" | "listening" | "thinking" | "tool" | "speaking" | "error" | "closed";

export interface RealtimeCallbacks {
  keyRefs: { openai?: string | null };
  onStatus: (s: RealtimeStatus) => void;
  onUserTranscript: (text: string) => void;
  onAssistantText: (text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>;
  onError: (msg: string) => void;
}
export interface RealtimeHandle {
  stop: () => void;
  interrupt: () => void;
  setMuted: (m: boolean) => void;
}

/** Démarre une session vocale temps réel OpenAI Realtime (WebRTC). */
export async function startRealtimeSession(cb: RealtimeCallbacks): Promise<RealtimeHandle> {
  if (typeof window === "undefined" || !window.RTCPeerConnection) throw new Error("webrtc-unavailable");
  cb.onStatus("connecting");
  vlog("realtime-webrtc-connect-start");

  // 1) Token éphémère (serveur).
  const sres = await fetch("/api/voice/realtime/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyRefs: cb.keyRefs }) });
  const sdata = await sres.json().catch(() => ({}));
  if (!sdata.ok || !sdata.clientSecret) { cb.onError(sdata.error || "Session temps réel indisponible."); cb.onStatus("error"); throw new Error(sdata.reason || "no-secret"); }
  const token: string = sdata.clientSecret;
  const model: string = sdata.model || "gpt-4o-realtime-preview";

  // 2) Micro.
  let mic: MediaStream;
  try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { cb.onError("Micro refusé. Autorisez le microphone dans le navigateur."); cb.onStatus("error"); throw new Error("mic-denied"); }

  // 3) WebRTC + audio de sortie.
  const pc = new RTCPeerConnection();
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true; (audioEl as any).playsInline = true; audioEl.style.display = "none";
  document.body.appendChild(audioEl);
  pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; vlog("realtime-audio-output-start"); };
  mic.getTracks().forEach((t) => pc.addTrack(t, mic));

  const dc = pc.createDataChannel("oai-events");
  let assistantText = "";
  dc.onopen = () => {
    vlog("realtime-webrtc-connected");
    dc.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions: REALTIME_INSTRUCTIONS,
        modalities: ["audio", "text"],
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad" },
        tools: REALTIME_TOOLS,
        tool_choice: "auto",
      },
    }));
    cb.onStatus("listening");
    vlog("realtime-audio-input-start");
  };
  dc.onmessage = async (ev) => {
    let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
    switch (msg.type) {
      case "input_audio_buffer.speech_started": cb.onStatus("listening"); break;
      case "input_audio_buffer.speech_stopped": cb.onStatus("thinking"); break;
      case "conversation.item.input_audio_transcription.completed":
        if (msg.transcript) cb.onUserTranscript(String(msg.transcript).trim()); break;
      case "response.audio_transcript.delta":
        assistantText += msg.delta || ""; cb.onAssistantText(assistantText); cb.onStatus("speaking"); break;
      case "response.audio_transcript.done": assistantText = ""; break;
      case "response.function_call_arguments.done": {
        vlog("realtime-tool-call", { name: msg.name });
        cb.onStatus("tool");
        let argObj: Record<string, unknown> = {};
        try { argObj = JSON.parse(msg.arguments || "{}"); } catch { /* args vides */ }
        let out = "";
        try { out = await cb.onToolCall(String(msg.name), argObj); } catch { out = "Erreur lors de l'exécution de l'outil."; }
        vlog("realtime-tool-result", { name: msg.name });
        try {
          dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: msg.call_id, output: out } }));
          dc.send(JSON.stringify({ type: "response.create" }));
        } catch { /* canal fermé */ }
        break;
      }
      case "response.done": cb.onStatus("listening"); break;
      case "error": vlog("realtime-error", {}); cb.onError(msg.error?.message || "Erreur temps réel."); break;
    }
  };

  // 4) Échange SDP avec le token éphémère.
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" }, body: offer.sdp,
  });
  if (!sdpRes.ok) {
    cb.onError("Connexion temps réel refusée par OpenAI."); cb.onStatus("error");
    try { pc.close(); } catch { /* */ } mic.getTracks().forEach((t) => t.stop()); audioEl.remove();
    throw new Error("sdp-failed");
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() } as RTCSessionDescriptionInit);

  return {
    stop: () => {
      vlog("realtime-stop");
      try { dc.close(); } catch { /* */ }
      try { pc.close(); } catch { /* */ }
      mic.getTracks().forEach((t) => t.stop());
      try { audioEl.srcObject = null; audioEl.remove(); } catch { /* */ }
      cb.onStatus("closed");
    },
    interrupt: () => {
      vlog("realtime-interrupt");
      try { dc.send(JSON.stringify({ type: "response.cancel" })); } catch { /* */ }
      try { window.speechSynthesis?.cancel(); } catch { /* */ }
    },
    setMuted: (m: boolean) => { mic.getAudioTracks().forEach((t) => { t.enabled = !m; }); },
  };
}
