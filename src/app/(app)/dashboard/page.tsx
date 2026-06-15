import { redirect } from "next/navigation";

// Le Dashboard est désormais le « Command Center » (refonte produit Orkestra).
// Toute visite de l'ancienne route est redirigée pour ne pas casser les liens.
export default function DashboardRedirect() {
  redirect("/command-center");
}
