"use client";

import { useVoice } from "./VoiceProvider";
import { Mic } from "lucide-react";

/** Bouton flottant Orkestra Voice (mobile uniquement). */
export function VoiceFloatingButton() {
  const { open, openPanel, status } = useVoice();
  if (open) return null;
  return (
    <button
      onClick={openPanel}
      aria-label="Orkestra Voice"
      className="ork-interactive fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full text-white lg:hidden"
      style={{ background: "radial-gradient(120% 120% at 30% 25%, #9d8efc, #5b4fd1 60%, #45399f)", boxShadow: "0 14px 40px -10px rgba(109,94,242,.8)" }}
    >
      {status === "listening" && <span className="ork-aura" />}
      <Mic className="h-6 w-6" />
    </button>
  );
}
