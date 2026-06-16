import { redirect } from "next/navigation";

// La connexion des IA est désormais centralisée dans « Réglages & connexions »
// (/settings, onglet Connexions IA). L'ancienne route /connect redirige.
export default function ConnectRedirect() {
  redirect("/settings");
}
