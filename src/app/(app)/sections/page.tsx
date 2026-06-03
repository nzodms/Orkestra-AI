import { redirect } from "next/navigation";

// Section Builder n'est plus un module séparé en V1 : la génération de code
// Shopify se fait dans l'AI Council, mode « Code Shopify ». Toute visite de
// l'ancienne route est redirigée. (Le moteur de sections reste utilisé en
// interne par le mode Code Shopify.)
export default function SectionsRedirect() {
  redirect("/council?mode=code&q=" + encodeURIComponent("Crée une section Shopify premium adaptée à ma boutique."));
}
