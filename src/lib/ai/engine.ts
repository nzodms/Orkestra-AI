import type {
  ProductSeoResult,
  SectionResult,
  MerchantAudit,
  CouncilResult,
  CouncilMode,
  AIProviderId,
  SeoLevel,
} from "../types";

// ──────────────────────────────────────────────────────────────────────────
// Moteur de génération de contenu.
//
// En V1 (mock mode), ce moteur produit des sorties structurées réalistes à
// partir des entrées utilisateur + de la mémoire boutique. Quand les vrais
// providers seront branchés, ces fonctions composeront un prompt et
// parseront la réponse IA — la forme des résultats reste identique.
// ──────────────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ProductSeoInput {
  productName: string;
  url?: string;
  collection?: string;
  features?: string;
  benefits?: string;
  materials?: string;
  price?: string;
  audience?: string;
  keywords?: string;
  ton?: string;
  level: SeoLevel;
}

export function generateProductSeo(input: ProductSeoInput): ProductSeoResult {
  const name = input.productName || "Produit";
  const kw = (input.keywords || name)
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
  const primary = kw.slice(0, 3);
  const depth = input.level === "ultra" ? 3 : input.level === "poussé" ? 2 : 1;

  const features = (input.features || "")
    .split(/[,\n]/)
    .map((f) => f.trim())
    .filter(Boolean);
  const benefits = (input.benefits || "")
    .split(/[,\n]/)
    .map((b) => b.trim())
    .filter(Boolean);

  const baseScore = 62 + depth * 9;

  return {
    optimizedTitle: `${name} — ${primary[0] || "qualité premium"} | Livraison rapide`,
    h1: `${name} : ${input.audience ? `pensé pour ${input.audience}` : "le choix premium"}`,
    shortDescription: `Découvrez ${name}, ${
      benefits[0]?.toLowerCase() || "conçu pour durer"
    }. ${input.materials ? input.materials + ". " : ""}Idéal ${
      input.audience ? `pour ${input.audience}` : "au quotidien"
    }.`,
    longDescriptionHtml: buildLongDescription(name, benefits, features, input),
    benefits: benefits.length
      ? benefits
      : ["Qualité durable", "Confort optimal", "Design soigné"],
    features: features.length
      ? features
      : ["Matériaux sélectionnés", "Finitions premium", "Garantie incluse"],
    faq: [
      {
        q: `Quelles sont les caractéristiques de ${name} ?`,
        a: `${name} ${
          input.materials ? "est fabriqué avec " + input.materials + " et " : ""
        }offre ${benefits[0]?.toLowerCase() || "une qualité durable"}.`,
      },
      {
        q: "Quels sont les délais de livraison ?",
        a: "La livraison est rapide et suivie. Vous recevez un numéro de suivi dès l'expédition.",
      },
      {
        q: "Puis-je retourner le produit ?",
        a: "Oui, vous bénéficiez d'une politique de retour claire sous 14 jours.",
      },
    ].slice(0, depth + 1),
    metaTitle: `${name} | ${primary[0] || "Boutique"} de qualité`.slice(0, 60),
    metaDescription: `${name} : ${
      benefits[0]?.toLowerCase() || "qualité premium"
    }. Livraison rapide, paiement sécurisé. Commandez dès maintenant.`.slice(0, 155),
    imageAltTexts: [
      `${name} vue de face`,
      `${name} en situation ${input.audience ? "pour " + input.audience : "d'usage"}`,
      `Détail des finitions de ${name}`,
    ],
    handle: slugify(name),
    primaryKeywords: primary.length ? primary : [slugify(name)],
    longTailKeywords: [
      `acheter ${name.toLowerCase()}`,
      `${name.toLowerCase()} pas cher`,
      `meilleur ${name.toLowerCase()} ${new Date().getFullYear()}`,
      `${name.toLowerCase()} ${input.audience || "avis"}`,
    ],
    internalLinks: [
      input.collection ? `Collection « ${input.collection} »` : "Collection associée",
      "Guide d'achat de la catégorie",
      "FAQ livraison & retours",
    ],
    seoScore: Math.min(98, baseScore + (kw.length ? 6 : 0)),
    conversionScore: Math.min(96, baseScore - 4 + benefits.length * 2),
    recommendations: [
      "Ajoutez 3 à 5 images haute qualité avec alt text optimisé.",
      "Intégrez des avis clients pour renforcer la preuve sociale.",
      input.price ? "Affichez clairement le rapport qualité/prix." : "Indiquez le prix et les options de paiement.",
      depth < 3 ? "Passez en niveau « ultra » pour enrichir le maillage interne." : "Ajoutez une vidéo produit pour booster la conversion.",
    ],
  };
}

function buildLongDescription(
  name: string,
  benefits: string[],
  features: string[],
  input: ProductSeoInput
): string {
  const b = benefits.length ? benefits : ["Qualité durable", "Confort optimal", "Design soigné"];
  const f = features.length ? features : ["Matériaux premium", "Finitions soignées"];
  return `<div class="product-description">
  <h2>Pourquoi choisir ${name} ?</h2>
  <p>${name} a été pensé ${input.audience ? `pour ${input.audience}` : "pour celles et ceux qui exigent le meilleur"}. ${
    input.materials ? `Fabriqué avec ${input.materials}, il ` : "Il "
  }allie qualité et longévité.</p>
  <h3>Les bénéfices</h3>
  <ul>
${b.map((x) => `    <li><strong>${x}</strong></li>`).join("\n")}
  </ul>
  <h3>Caractéristiques</h3>
  <ul>
${f.map((x) => `    <li>${x}</li>`).join("\n")}
  </ul>
  <p>Commandez ${name} dès aujourd'hui et profitez d'une livraison rapide et d'un paiement 100% sécurisé.</p>
</div>`;
}

// ── Section Builder ───────────────────────────────────────────────────────

export interface SectionInput {
  type: string;
  goal?: string;
  page?: string; // home | produit | collection | blog | page
  style?: string; // premium | minimal | apple | luxe | éditorial | conversion | glassmorphism
  tone?: string;
  colors?: string;
  content?: string;
  animation?: string; // aucune | fade-in | slide-up | accordéon | hover | reveal | sticky
  animations?: boolean; // compat
  complexity?: "simple" | "avancé" | "ultra premium" | "standard";
  mobilePriority?: boolean;
  needsSettings?: boolean;
  allowJs?: boolean;
  noJsVersion?: boolean;
  collection?: string;
  product?: string;
  niche?: string;
  brandName?: string;
  pieces?: string[];
}

/** Clé interne de type de section. */
function sectionKey(type: string): string {
  const t = (type || "").toLowerCase();
  if (/faq/.test(t)) return "faq";
  if (/comparat|comparaison/.test(t)) return "comparison";
  if (/bénéfice|benefice|avantage/.test(t)) return "benefits";
  if (/storytelling|histoire|à propos/.test(t)) return "storytelling";
  if (/avis|témoign|temoign|review/.test(t)) return "reviews";
  if (/taille|guide des tailles|sizing/.test(t)) return "sizeguide";
  if (/avant.?apr|avant\/apr/.test(t)) return "beforeafter";
  if (/réassur|reassur|confiance/.test(t)) return "reassurance";
  if (/sticky|add.?to.?cart|panier/.test(t)) return "sticky";
  if (/image.*texte|texte.*image|split/.test(t)) return "imagetext";
  if (/collection/.test(t)) return "collection";
  return "hero";
}

interface SecCtx {
  id: string;
  accent: string;
  anim: boolean;
  niche: string;
  pieces: string[];
  brand: string;
}

export function generateSection(input: SectionInput): SectionResult {
  const type = input.type || "Hero premium";
  const key = sectionKey(type);
  const accent = (input.colors && /^#?[0-9a-f]{3,8}$/i.test(input.colors.trim()) ? input.colors.trim() : input.colors) || "#6d5ef2";
  const id = slugify(type) || "section";
  const anim = input.animation ? input.animation !== "aucune" : input.animations !== false;
  const niche = input.niche || "votre boutique";
  const pieces = input.pieces?.length ? input.pieces : ["salon", "chambre", "cuisine"];
  const sc: SecCtx = { id, accent: accent.startsWith("#") ? accent : `#${accent}`, anim, niche, pieces, brand: input.brandName || "votre marque" };

  const built = buildSection(key, sc, input);
  const complexity = input.complexity || "avancé";

  // ── Vérification qualité avant affichage ──
  const warnings: string[] = [];
  if (!built.liquid.includes("{% schema %}") && !built.schema.includes("{% schema %}")) warnings.push("Schema manquant.");
  if (!/\.ork-/.test(built.css)) warnings.push("Classes CSS non préfixées détectées.");
  if (built.needsJs && !built.js.trim()) warnings.push("JS attendu mais absent.");
  try {
    const json = built.schema.replace(/{%\s*schema\s*%}/, "").replace(/{%\s*endschema\s*%}/, "").trim();
    JSON.parse(json);
  } catch {
    warnings.push("Le schema JSON pourrait être invalide — vérifiez avant publication.");
  }

  const summary = `**Objectif** : ${input.goal || sectionPurpose(key)}.
**Emplacement recommandé** : ${sectionPlacement(key, input.page)}.
**Pourquoi** : ${sectionWhy(key)}.
**Données utilisées** : niche « ${niche} »${input.collection ? `, collection « ${input.collection} »` : ""}${input.product ? `, produit « ${input.product} »` : ""}, ton ${input.tone || "premium"}, style ${input.style || "premium"}.`;

  return {
    summary,
    liquid: built.liquid,
    css: built.css,
    js: built.js || "// Aucun JavaScript nécessaire pour cette section.",
    schema: built.schema,
    installSteps: [
      `Admin Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code.`,
      `Sections → Ajouter un fichier → nommez-le « ${id}.liquid ».`,
      `Collez le code Liquid + le bloc {% schema %} ci-dessous dans ce fichier.`,
      built.needsJs
        ? `Le CSS et le JS sont inclus dans le fichier (balises <style>/<script>) — aucun asset externe à ajouter.`
        : `Le CSS est inclus dans le fichier (balise <style>) — aucun asset externe à ajouter.`,
      `Enregistrez, puis ajoutez la section via Personnaliser et réglez les options dans le customizer.`,
      `Checklist avant publication : aperçu mobile, contenu réel, contraste, liens des CTA.`,
    ],
    responsiveChecklist: [
      { label: "Desktop : grille/hiérarchie propre", ok: true },
      { label: "Mobile : layout repensé (pas juste réduit)", ok: true },
      { label: "Images : ratio fixe, pas de saut de mise en page", ok: true },
      { label: "CTA : cible tactile ≥ 44px", ok: true },
      { label: "Spacing : clamp() fluide", ok: true },
      { label: "Accessibilité : contraste + focus visibles", ok: true },
      { label: "Vitesse : aucune librairie externe", ok: true },
    ],
    warnings,
    complexity,
  };
}

function sectionPurpose(key: string): string {
  const m: Record<string, string> = {
    hero: "capter l'attention et orienter vers l'action principale",
    faq: "lever les objections et capter les rich snippets FAQ",
    comparison: "aider à choisir et justifier le prix (conversion)",
    benefits: "résumer les bénéfices clés en un coup d'œil",
    storytelling: "incarner la marque et créer du lien émotionnel",
    reviews: "renforcer la preuve sociale et la confiance",
    sizeguide: "réduire les hésitations et les retours",
    beforeafter: "démontrer le résultat de façon visuelle",
    reassurance: "rassurer immédiatement (livraison, retours, paiement)",
    sticky: "garder le bouton d'achat toujours accessible (conversion mobile)",
    imagetext: "présenter un argument fort avec un visuel",
    collection: "mettre en avant une collection et son contenu SEO",
  };
  return m[key] || "améliorer l'expérience et la conversion";
}
function sectionPlacement(key: string, page?: string): string {
  const m: Record<string, string> = {
    hero: "tout en haut de la page d'accueil",
    faq: "bas de page produit et bas de page collection",
    comparison: "page produit, sous la description",
    benefits: "page d'accueil et page produit, au-dessus de la ligne de flottaison",
    storytelling: "page d'accueil (milieu) ou page À propos",
    reviews: "page d'accueil et page produit",
    sizeguide: "page produit (onglet ou sous le sélecteur)",
    beforeafter: "page produit ou page d'accueil",
    reassurance: "juste sous le hero (home) et sous le prix (produit)",
    sticky: "page produit (barre flottante mobile + desktop)",
    imagetext: "page d'accueil ou page produit",
    collection: "page d'accueil ou haut de page collection",
  };
  return page ? `${m[key] || "selon votre besoin"} (page ${page})` : m[key] || "selon votre besoin";
}
function sectionWhy(key: string): string {
  const m: Record<string, string> = {
    faq: "répond aux questions fréquentes → moins d'abandons + SEO (FAQ schema).",
    reassurance: "les signaux de confiance augmentent le taux de conversion, surtout sur mobile.",
    reviews: "la preuve sociale est l'un des leviers de conversion les plus forts.",
    sticky: "l'accès permanent au CTA d'achat améliore nettement la conversion mobile.",
    comparison: "clarifier les différences réduit l'hésitation et justifie le prix.",
  };
  return m[key] || "structure premium + responsive soigné = meilleure conversion et image de marque.";
}

interface BuiltSection { liquid: string; css: string; js: string; schema: string; needsJs: boolean }

function buildSection(key: string, c: SecCtx, input: SectionInput): BuiltSection {
  switch (key) {
    case "faq": return buildFaq(c);
    case "reassurance": return buildReassurance(c);
    case "benefits": return buildBenefits(c);
    case "imagetext": return buildImageText(c);
    case "reviews": return buildReviews(c);
    case "comparison": return buildComparison(c);
    case "collection": return buildCollection(c, input);
    case "storytelling": return buildStorytelling(c);
    case "sticky": return buildSticky(c, input);
    case "sizeguide": return buildSizeGuide(c);
    case "beforeafter": return buildBeforeAfter(c, input);
    default: return buildHero(c);
  }
}

// Base CSS commune (namespacée).
function baseCss(id: string, accent: string): string {
  return `.ork-${id}{--ork-accent:{{ section.settings.accent_color | default: '${accent}' }};--ork-radius:16px;padding:clamp(40px,7vw,88px) 20px;color:#1a1a1a;}
.ork-${id} *{box-sizing:border-box;}
.ork-${id} .ork-wrap{max-width:1120px;margin:0 auto;}
.ork-${id} .ork-eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ork-accent);font-weight:600;}
.ork-${id} .ork-h{font-size:clamp(26px,4vw,42px);line-height:1.12;font-weight:700;margin:.3em 0;}
.ork-${id} .ork-sub{font-size:clamp(15px,2vw,18px);color:#555;max-width:60ch;}
.ork-${id} .ork-cta{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:13px 26px;border-radius:999px;background:var(--ork-accent);color:#fff;font-weight:600;text-decoration:none;transition:transform .2s ease,box-shadow .2s ease;}
.ork-${id} .ork-cta:hover{transform:translateY(-2px);box-shadow:0 10px 30px -10px var(--ork-accent);}
@media (prefers-reduced-motion:reduce){.ork-${id} *{animation:none!important;transition:none!important;}}`;
}
function fadeCss(id: string, anim: boolean): string {
  return anim
    ? `\n.ork-${id} [data-ork-reveal]{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease;}
.ork-${id} [data-ork-reveal].is-in{opacity:1;transform:none;}`
    : "";
}
function revealJs(id: string, anim: boolean): string {
  if (!anim) return "";
  return `(function(){
  var els=document.querySelectorAll('.ork-${id} [data-ork-reveal]');
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('is-in');});return;}
  var io=new IntersectionObserver(function(ent){ent.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}});},{threshold:.15});
  els.forEach(function(e){io.observe(e);});
})();`;
}

function buildHero(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Hero premium (Online Store 2.0) {% endcomment %}
<section class="ork-${id}" data-section-id="{{ section.id }}">
  <div class="ork-wrap ork-${id}__grid">
    <div class="ork-${id}__content" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Un titre fort et clair' }}</h2>
      {% if section.settings.subheading != blank %}<p class="ork-sub">{{ section.settings.subheading }}</p>{% endif %}
      <div class="ork-${id}__cta-row">
        {% if section.settings.button_label != blank %}<a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a>{% endif %}
        {% if section.settings.button2_label != blank %}<a class="ork-${id}__cta2" href="{{ section.settings.button2_link }}">{{ section.settings.button2_label }}</a>{% endif %}
      </div>
      {% if section.blocks.size > 0 %}
      <ul class="ork-${id}__badges">
        {% for block in section.blocks %}<li {{ block.shopify_attributes }}>{{ block.settings.label }}</li>{% endfor %}
      </ul>
      {% endif %}
    </div>
    <div class="ork-${id}__media" data-ork-reveal>
      {% if section.settings.image != blank %}
        <img src="{{ section.settings.image | image_url: width: 1200 }}" alt="{{ section.settings.image.alt | escape }}" width="600" height="600" loading="lazy">
      {% else %}
        <div class="ork-${id}__ph" role="img" aria-label="Emplacement visuel"></div>
      {% endif %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__grid{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(24px,4vw,56px);align-items:center;}
.ork-${id}__cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;}
.ork-${id}__cta2{display:inline-flex;align-items:center;min-height:46px;padding:13px 22px;border-radius:999px;border:1px solid #e3e3e8;color:#1a1a1a;text-decoration:none;font-weight:600;}
.ork-${id}__badges{list-style:none;display:flex;flex-wrap:wrap;gap:10px 20px;padding:0;margin:26px 0 0;font-size:14px;color:#444;}
.ork-${id}__badges li{display:flex;align-items:center;gap:6px;}
.ork-${id}__badges li::before{content:'✓';color:var(--ork-accent);font-weight:700;}
.ork-${id}__media img,.ork-${id}__ph{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--ork-radius);box-shadow:0 24px 60px -24px rgba(16,24,40,.25);}
.ork-${id}__ph{background:linear-gradient(135deg,var(--ork-accent),#0000), #f1f1f5;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}.ork-${id}__media{order:-1;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Hero premium",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Un titre fort et clair" },
    { "type": "textarea", "id": "subheading", "label": "Sous-titre" },
    { "type": "image_picker", "id": "image", "label": "Visuel" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA principal", "default": "Découvrir" },
    { "type": "url", "id": "button_link", "label": "Lien CTA principal" },
    { "type": "text", "id": "button2_label", "label": "CTA secondaire" },
    { "type": "url", "id": "button2_link", "label": "Lien CTA secondaire" }
  ],
  "blocks": [
    { "type": "badge", "name": "Badge réassurance", "settings": [ { "type": "text", "id": "label", "label": "Texte", "default": "Livraison gratuite" } ] }
  ],
  "max_blocks": 4,
  "presets": [{ "name": "Hero premium", "blocks": [ { "type": "badge" }, { "type": "badge" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildFaq(c: SecCtx): BuiltSection {
  const id = c.id;
  // Accordéon natif <details>/<summary> → accessible et SANS JS.
  const liquid = `{% comment %} Orkestra — FAQ (accordéon natif, sans JS) {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Questions fréquentes' }}</h2>
    </div>
    <div class="ork-${id}__list">
      {% for block in section.blocks %}
      <details class="ork-${id}__item" {% if forloop.first and section.settings.open_first %}open{% endif %} {{ block.shopify_attributes }}>
        <summary class="ork-${id}__q">{{ block.settings.question | default: 'Votre question ?' }}<span class="ork-${id}__icon" aria-hidden="true"></span></summary>
        <div class="ork-${id}__a">{{ block.settings.answer }}</div>
      </details>
      {% endfor %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:clamp(20px,3vw,36px);}
.ork-${id}__list{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:12px;}
.ork-${id}__item{border:1px solid #ececf1;border-radius:var(--ork-radius);background:#fff;overflow:hidden;}
.ork-${id}__q{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 20px;font-weight:600;font-size:16px;}
.ork-${id}__q::-webkit-details-marker{display:none;}
.ork-${id}__icon{position:relative;width:14px;height:14px;flex:none;}
.ork-${id}__icon::before,.ork-${id}__icon::after{content:'';position:absolute;background:var(--ork-accent);border-radius:2px;transition:transform .25s ease;}
.ork-${id}__icon::before{top:6px;left:0;width:14px;height:2px;}
.ork-${id}__icon::after{top:0;left:6px;width:2px;height:14px;}
.ork-${id}__item[open] .ork-${id}__icon::after{transform:scaleY(0);}
.ork-${id}__a{padding:0 20px 18px;color:#555;line-height:1.6;}
.ork-${id}__item[open]{border-color:var(--ork-accent);box-shadow:0 12px 30px -18px rgba(16,24,40,.2);}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "FAQ",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Questions fréquentes" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "checkbox", "id": "open_first", "label": "Ouvrir la 1re question", "default": true }
  ],
  "blocks": [
    { "type": "qa", "name": "Question", "settings": [
      { "type": "text", "id": "question", "label": "Question", "default": "${c.niche.includes("lumi") ? "À quelle hauteur installer ma suspension ?" : "Votre question ?"}" },
      { "type": "richtext", "id": "answer", "label": "Réponse", "default": "<p>Votre réponse claire et rassurante.</p>" }
    ] }
  ],
  "max_blocks": 12,
  "presets": [{ "name": "FAQ", "blocks": [ { "type": "qa" }, { "type": "qa" }, { "type": "qa" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildReassurance(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Bloc réassurance {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap ork-${id}__grid">
    {% for block in section.blocks %}
    <div class="ork-${id}__item" data-ork-reveal {{ block.shopify_attributes }}>
      {% if block.settings.icon != blank %}<img class="ork-${id}__ic" src="{{ block.settings.icon | image_url: width: 96 }}" alt="" width="40" height="40" loading="lazy">{% else %}<span class="ork-${id}__ic ork-${id}__ic--ph" aria-hidden="true">★</span>{% endif %}
      <div><p class="ork-${id}__t">{{ block.settings.title | default: 'Avantage' }}</p>{% if block.settings.text != blank %}<p class="ork-${id}__d">{{ block.settings.text }}</p>{% endif %}</div>
    </div>
    {% endfor %}
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}{padding-block:clamp(28px,4vw,48px);}
.ork-${id}__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(14px,2vw,24px);}
.ork-${id}__item{display:flex;gap:12px;align-items:center;padding:16px;border:1px solid #ececf1;border-radius:var(--ork-radius);background:#fff;}
.ork-${id}__ic{width:40px;height:40px;display:grid;place-items:center;border-radius:10px;background:color-mix(in srgb,var(--ork-accent) 12%,#fff);color:var(--ork-accent);}
.ork-${id}__t{font-weight:600;margin:0;}
.ork-${id}__d{margin:2px 0 0;color:#666;font-size:14px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:repeat(2,1fr);}}
@media (max-width:480px){.ork-${id}__grid{grid-template-columns:1fr;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Réassurance",
  "tag": "section",
  "settings": [ { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" } ],
  "blocks": [
    { "type": "item", "name": "Atout", "settings": [
      { "type": "image_picker", "id": "icon", "label": "Icône (optionnel)" },
      { "type": "text", "id": "title", "label": "Titre", "default": "Livraison gratuite" },
      { "type": "text", "id": "text", "label": "Texte", "default": "Dès 49€ d'achat" }
    ] }
  ],
  "max_blocks": 6,
  "presets": [{ "name": "Réassurance", "blocks": [ { "type": "item" }, { "type": "item" }, { "type": "item" }, { "type": "item" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildBenefits(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Section bénéfices {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Pourquoi nous choisir' }}</h2>
    </div>
    <div class="ork-${id}__grid">
      {% for block in section.blocks %}
      <article class="ork-${id}__card" data-ork-reveal {{ block.shopify_attributes }}>
        <span class="ork-${id}__ic" aria-hidden="true">{{ block.settings.emoji | default: '✦' }}</span>
        <h3 class="ork-${id}__t">{{ block.settings.title | default: 'Bénéfice' }}</h3>
        <p class="ork-${id}__d">{{ block.settings.text }}</p>
      </article>
      {% endfor %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:clamp(24px,3vw,40px);}
.ork-${id}__head .ork-h{margin-inline:auto;}
.ork-${id}__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(16px,2vw,24px);}
.ork-${id}__card{padding:26px;border:1px solid #ececf1;border-radius:var(--ork-radius);background:#fff;transition:transform .2s ease,box-shadow .2s ease;}
.ork-${id}__card:hover{transform:translateY(-4px);box-shadow:0 18px 40px -22px rgba(16,24,40,.25);}
.ork-${id}__ic{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;font-size:20px;background:color-mix(in srgb,var(--ork-accent) 12%,#fff);}
.ork-${id}__t{font-size:18px;margin:16px 0 6px;}
.ork-${id}__d{color:#666;line-height:1.55;margin:0;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Bénéfices",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Pourquoi nous choisir" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" }
  ],
  "blocks": [
    { "type": "benefit", "name": "Bénéfice", "settings": [
      { "type": "text", "id": "emoji", "label": "Icône (emoji)", "default": "✦" },
      { "type": "text", "id": "title", "label": "Titre", "default": "Qualité durable" },
      { "type": "textarea", "id": "text", "label": "Texte", "default": "Des matériaux sélectionnés pour durer." }
    ] }
  ],
  "max_blocks": 6,
  "presets": [{ "name": "Bénéfices", "blocks": [ { "type": "benefit" }, { "type": "benefit" }, { "type": "benefit" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildImageText(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Image + texte {% endcomment %}
<section class="ork-${id} ork-${id}--{{ section.settings.image_position }}">
  <div class="ork-wrap ork-${id}__grid">
    <div class="ork-${id}__media" data-ork-reveal>
      {% if section.settings.image != blank %}<img src="{{ section.settings.image | image_url: width: 1000 }}" alt="{{ section.settings.image.alt | escape }}" width="560" height="460" loading="lazy">{% else %}<div class="ork-${id}__ph" role="img" aria-label="Visuel"></div>{% endif %}
    </div>
    <div class="ork-${id}__content" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Un argument fort' }}</h2>
      {% if section.settings.text != blank %}<div class="ork-sub">{{ section.settings.text }}</div>{% endif %}
      {% if section.blocks.size > 0 %}<ul class="ork-${id}__points">{% for block in section.blocks %}<li {{ block.shopify_attributes }}>{{ block.settings.label }}</li>{% endfor %}</ul>{% endif %}
      {% if section.settings.button_label != blank %}<a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a>{% endif %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,56px);align-items:center;}
.ork-${id}--right .ork-${id}__media{order:2;}
.ork-${id}__media img,.ork-${id}__ph{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--ork-radius);box-shadow:0 24px 60px -28px rgba(16,24,40,.3);}
.ork-${id}__ph{background:#f1f1f5;}
.ork-${id}__points{list-style:none;padding:0;margin:18px 0;display:grid;gap:10px;}
.ork-${id}__points li{display:flex;gap:10px;align-items:flex-start;color:#444;}
.ork-${id}__points li::before{content:'✓';color:var(--ork-accent);font-weight:700;}
.ork-${id} .ork-cta{margin-top:8px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}.ork-${id}--right .ork-${id}__media{order:-1;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Image + texte",
  "tag": "section",
  "settings": [
    { "type": "select", "id": "image_position", "label": "Position image", "default": "left", "options": [ { "value": "left", "label": "Gauche" }, { "value": "right", "label": "Droite" } ] },
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Un argument fort" },
    { "type": "richtext", "id": "text", "label": "Texte", "default": "<p>Décrivez ici votre promesse.</p>" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA" },
    { "type": "url", "id": "button_link", "label": "Lien CTA" }
  ],
  "blocks": [ { "type": "point", "name": "Point clé", "settings": [ { "type": "text", "id": "label", "label": "Texte", "default": "Un point clé" } ] } ],
  "max_blocks": 5,
  "presets": [{ "name": "Image + texte", "blocks": [ { "type": "point" }, { "type": "point" }, { "type": "point" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildReviews(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Avis clients (grille, sans JS) {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal>
      <h2 class="ork-h">{{ section.settings.heading | default: 'Ils nous font confiance' }}</h2>
    </div>
    <div class="ork-${id}__grid">
      {% for block in section.blocks %}
      <figure class="ork-${id}__card" data-ork-reveal {{ block.shopify_attributes }}>
        <div class="ork-${id}__stars" aria-label="{{ block.settings.rating }} sur 5">{% assign r = block.settings.rating | default: 5 %}{% for i in (1..5) %}<span class="{% if i <= r %}is-on{% endif %}">★</span>{% endfor %}</div>
        <blockquote class="ork-${id}__q">{{ block.settings.text }}</blockquote>
        <figcaption class="ork-${id}__by"><span class="ork-${id}__av" aria-hidden="true">{{ block.settings.name | slice: 0 }}</span>{{ block.settings.name | default: 'Client vérifié' }}{% if block.settings.verified %} <span class="ork-${id}__vf">✓ Vérifié</span>{% endif %}</figcaption>
      </figure>
      {% endfor %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:clamp(20px,3vw,36px);}
.ork-${id}__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(16px,2vw,22px);}
.ork-${id}__card{padding:22px;border:1px solid #ececf1;border-radius:var(--ork-radius);background:#fff;margin:0;}
.ork-${id}__stars{color:#d8d8df;letter-spacing:2px;}
.ork-${id}__stars .is-on{color:#f5b301;}
.ork-${id}__q{margin:12px 0 16px;color:#333;line-height:1.55;font-size:15px;}
.ork-${id}__by{display:flex;align-items:center;gap:10px;font-weight:600;font-size:14px;}
.ork-${id}__av{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--ork-accent);color:#fff;text-transform:uppercase;}
.ork-${id}__vf{color:#16a34a;font-weight:600;font-size:12px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Avis clients",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "Ils nous font confiance" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" }
  ],
  "blocks": [
    { "type": "review", "name": "Avis", "settings": [
      { "type": "range", "id": "rating", "label": "Note", "min": 1, "max": 5, "step": 1, "default": 5 },
      { "type": "textarea", "id": "text", "label": "Avis", "default": "Produit conforme et livraison rapide, je recommande !" },
      { "type": "text", "id": "name", "label": "Prénom", "default": "Camille" },
      { "type": "checkbox", "id": "verified", "label": "Badge vérifié", "default": true }
    ] }
  ],
  "max_blocks": 9,
  "presets": [{ "name": "Avis clients", "blocks": [ { "type": "review" }, { "type": "review" }, { "type": "review" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildComparison(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Comparatif {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal><h2 class="ork-h">{{ section.settings.heading | default: 'Pourquoi nous comparer' }}</h2></div>
    <div class="ork-${id}__scroll">
      <table class="ork-${id}__table">
        <thead><tr><th>{{ section.settings.col_feature | default: 'Critère' }}</th><th class="is-us">{{ section.settings.col_us | default: 'Nous' }}</th><th>{{ section.settings.col_other | default: 'Autres' }}</th></tr></thead>
        <tbody>
          {% for block in section.blocks %}
          <tr {{ block.shopify_attributes }}><td>{{ block.settings.feature }}</td><td class="is-us">{% if block.settings.us %}✓{% else %}—{% endif %}</td><td>{% if block.settings.other %}✓{% else %}—{% endif %}</td></tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
    {% if section.settings.button_label != blank %}<div class="ork-${id}__cta-row"><a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a></div>{% endif %}
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:24px;}
.ork-${id}__scroll{overflow-x:auto;border-radius:var(--ork-radius);border:1px solid #ececf1;}
.ork-${id}__table{width:100%;border-collapse:collapse;min-width:520px;background:#fff;}
.ork-${id}__table th,.ork-${id}__table td{padding:14px 18px;text-align:left;border-bottom:1px solid #f0f0f4;}
.ork-${id}__table thead th{font-size:14px;color:#555;}
.ork-${id}__table .is-us{background:color-mix(in srgb,var(--ork-accent) 8%,#fff);font-weight:600;text-align:center;}
.ork-${id}__table td.is-us{color:var(--ork-accent);font-size:18px;}
.ork-${id}__table td:nth-child(3){text-align:center;color:#aaa;}
.ork-${id}__cta-row{text-align:center;margin-top:24px;}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Comparatif",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "Pourquoi nous comparer" },
    { "type": "text", "id": "col_feature", "label": "Colonne critère", "default": "Critère" },
    { "type": "text", "id": "col_us", "label": "Colonne nous", "default": "Nous" },
    { "type": "text", "id": "col_other", "label": "Colonne autres", "default": "Autres" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA", "default": "Découvrir" },
    { "type": "url", "id": "button_link", "label": "Lien CTA" }
  ],
  "blocks": [
    { "type": "row", "name": "Ligne", "settings": [
      { "type": "text", "id": "feature", "label": "Critère", "default": "Qualité premium" },
      { "type": "checkbox", "id": "us", "label": "Nous", "default": true },
      { "type": "checkbox", "id": "other", "label": "Autres", "default": false }
    ] }
  ],
  "max_blocks": 12,
  "presets": [{ "name": "Comparatif", "blocks": [ { "type": "row" }, { "type": "row" }, { "type": "row" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildCollection(c: SecCtx, input: SectionInput): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Collection premium {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Notre collection' }}</h2>
      {% if section.settings.text != blank %}<div class="ork-sub">{{ section.settings.text }}</div>{% endif %}
    </div>
    {% assign coll = section.settings.collection %}
    <div class="ork-${id}__grid">
      {% if coll != blank %}
        {% for product in coll.products limit: section.settings.count %}
        <a class="ork-${id}__card" href="{{ product.url }}" data-ork-reveal>
          <span class="ork-${id}__img">{% if product.featured_image %}<img src="{{ product.featured_image | image_url: width: 600 }}" alt="{{ product.featured_image.alt | escape }}" width="300" height="300" loading="lazy">{% endif %}</span>
          <span class="ork-${id}__name">{{ product.title }}</span>
          <span class="ork-${id}__price">{{ product.price | money }}</span>
        </a>
        {% endfor %}
      {% else %}
        {% for i in (1..section.settings.count) %}<div class="ork-${id}__card ork-${id}__card--ph" data-ork-reveal><span class="ork-${id}__img"></span><span class="ork-${id}__name">Produit {{ i }}</span></div>{% endfor %}
      {% endif %}
    </div>
    {% if section.settings.button_label != blank %}<div class="ork-${id}__cta-row"><a class="ork-cta" href="{{ section.settings.button_link | default: coll.url }}">{{ section.settings.button_label }}</a></div>{% endif %}
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:clamp(20px,3vw,36px);}
.ork-${id}__head .ork-sub{margin-inline:auto;}
.ork-${id}__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(14px,2vw,22px);}
.ork-${id}__card{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit;}
.ork-${id}__img{display:block;aspect-ratio:1/1;border-radius:var(--ork-radius);overflow:hidden;background:#f1f1f5;}
.ork-${id}__img img{width:100%;height:100%;object-fit:cover;transition:transform .35s ease;}
.ork-${id}__card:hover .ork-${id}__img img{transform:scale(1.05);}
.ork-${id}__name{font-weight:600;font-size:15px;}
.ork-${id}__price{color:var(--ork-accent);font-weight:600;}
.ork-${id}__cta-row{text-align:center;margin-top:28px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:repeat(2,1fr);}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Collection premium",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Sur-titre" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "${input.collection || "Notre collection"}" },
    { "type": "richtext", "id": "text", "label": "Texte SEO court", "default": "<p>Une sélection ${c.niche}.</p>" },
    { "type": "collection", "id": "collection", "label": "Collection Shopify" },
    { "type": "range", "id": "count", "label": "Nombre de produits", "min": 2, "max": 12, "step": 1, "default": 4 },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA", "default": "Voir la collection" },
    { "type": "url", "id": "button_link", "label": "Lien CTA (sinon collection)" }
  ],
  "presets": [{ "name": "Collection premium" }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildStorytelling(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Storytelling {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap ork-${id}__grid">
    <div class="ork-${id}__media" data-ork-reveal>{% if section.settings.image != blank %}<img src="{{ section.settings.image | image_url: width: 1000 }}" alt="{{ section.settings.image.alt | escape }}" width="540" height="620" loading="lazy">{% else %}<div class="ork-${id}__ph" role="img" aria-label="Visuel"></div>{% endif %}</div>
    <div class="ork-${id}__content" data-ork-reveal>
      {% if section.settings.eyebrow != blank %}<span class="ork-eyebrow">{{ section.settings.eyebrow }}</span>{% endif %}
      <h2 class="ork-h">{{ section.settings.heading | default: 'Notre histoire' }}</h2>
      {% if section.settings.text != blank %}<div class="ork-sub">{{ section.settings.text }}</div>{% endif %}
      {% if section.settings.button_label != blank %}<a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a>{% endif %}
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}{background:linear-gradient(180deg,color-mix(in srgb,var(--ork-accent) 5%,#fff),#fff);}
.ork-${id}__grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(24px,4vw,56px);align-items:center;}
.ork-${id}__media img,.ork-${id}__ph{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--ork-radius);box-shadow:0 30px 70px -30px rgba(16,24,40,.35);}
.ork-${id}__ph{background:#eceaf6;}
.ork-${id} .ork-cta{margin-top:18px;}
@media (max-width:860px){.ork-${id}__grid{grid-template-columns:1fr;}}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Storytelling",
  "tag": "section",
  "settings": [
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "text", "id": "eyebrow", "label": "Sur-titre", "default": "Notre marque" },
    { "type": "text", "id": "heading", "label": "Titre", "default": "Notre histoire" },
    { "type": "richtext", "id": "text", "label": "Récit", "default": "<p>Racontez ici la naissance de ${c.brand} et votre mission.</p>" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" },
    { "type": "text", "id": "button_label", "label": "CTA" },
    { "type": "url", "id": "button_link", "label": "Lien CTA" }
  ],
  "presets": [{ "name": "Storytelling" }]
}
{% endschema %}`;
  return { liquid, css, js: revealJs(id, c.anim), schema, needsJs: c.anim };
}

function buildSticky(c: SecCtx, input: SectionInput): BuiltSection {
  const id = c.id;
  // Nécessite du JS (afficher au scroll). Encapsulé, sans pollution globale.
  const liquid = `{% comment %} Orkestra — Sticky add-to-cart (à placer dans product.json) {% endcomment %}
<div class="ork-${id}" id="ork-${id}" hidden>
  <div class="ork-wrap ork-${id}__bar">
    <span class="ork-${id}__title">{{ product.title | default: section.settings.fallback_title }}</span>
    {% if product %}<span class="ork-${id}__price">{{ product.selected_or_first_available_variant.price | money }}</span>{% endif %}
    {% if product %}
    <form method="post" action="/cart/add" class="ork-${id}__form">
      <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}">
      <button type="submit" class="ork-cta" {% unless product.available %}disabled{% endunless %}>{% if product.available %}{{ section.settings.button_label | default: 'Ajouter au panier' }}{% else %}Épuisé{% endif %}</button>
    </form>
    {% else %}<a class="ork-cta" href="{{ section.settings.button_link }}">{{ section.settings.button_label | default: 'Ajouter au panier' }}</a>{% endif %}
  </div>
</div>`;
  const css = `.ork-${id}{position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(255,255,255,.92);backdrop-filter:saturate(160%) blur(10px);border-top:1px solid #ececf1;transform:translateY(100%);transition:transform .3s ease;}
.ork-${id}.is-visible{transform:none;}
.ork-${id} .ork-wrap{max-width:1120px;margin:0 auto;}
.ork-${id}__bar{display:flex;align-items:center;gap:16px;padding:12px 20px;}
.ork-${id}__title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ork-${id}__price{font-weight:700;color:{{ section.settings.accent_color | default: '${c.accent}' }};}
.ork-${id}__form{margin:0;}
.ork-${id} .ork-cta{background:{{ section.settings.accent_color | default: '${c.accent}' }};}
@media (max-width:600px){.ork-${id}__price{display:none;}.ork-${id}__title{font-size:14px;}}`;
  const js = `(function(){
  var bar=document.getElementById('ork-${id}');
  if(!bar)return;
  bar.hidden=false;
  var trigger=document.querySelector('[name="add"], .product-form__submit, form[action*="/cart/add"] button[type="submit"]');
  function toggle(){
    var show=true;
    if(trigger){var r=trigger.getBoundingClientRect();show=(r.bottom<0||r.top>window.innerHeight);}
    else{show=window.scrollY>500;}
    bar.classList.toggle('is-visible',show);
  }
  window.addEventListener('scroll',toggle,{passive:true});
  window.addEventListener('resize',toggle);toggle();
})();`;
  const schema = `{% schema %}
{
  "name": "Sticky panier",
  "tag": "section",
  "settings": [
    { "type": "paragraph", "content": "À ajouter sur le modèle Produit (product.json). Le prix et le bouton utilisent le produit courant." },
    { "type": "text", "id": "button_label", "label": "Texte du bouton", "default": "Ajouter au panier" },
    { "type": "text", "id": "fallback_title", "label": "Titre de repli", "default": "${input.product || "Notre produit"}" },
    { "type": "url", "id": "button_link", "label": "Lien (hors page produit)" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" }
  ],
  "presets": [{ "name": "Sticky panier" }]
}
{% endschema %}`;
  return { liquid, css, js, schema, needsJs: true };
}

function buildSizeGuide(c: SecCtx): BuiltSection {
  const id = c.id;
  const liquid = `{% comment %} Orkestra — Guide des tailles {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal><h2 class="ork-h">{{ section.settings.heading | default: 'Guide des tailles' }}</h2>{% if section.settings.intro != blank %}<p class="ork-sub">{{ section.settings.intro }}</p>{% endif %}</div>
    <div class="ork-${id}__scroll">
      <table class="ork-${id}__table">
        <thead><tr><th>{{ section.settings.c1 | default: 'Taille' }}</th><th>{{ section.settings.c2 | default: 'A (cm)' }}</th><th>{{ section.settings.c3 | default: 'B (cm)' }}</th></tr></thead>
        <tbody>{% for block in section.blocks %}<tr {{ block.shopify_attributes }}><td>{{ block.settings.v1 }}</td><td>{{ block.settings.v2 }}</td><td>{{ block.settings.v3 }}</td></tr>{% endfor %}</tbody>
      </table>
    </div>
    {% if section.settings.note != blank %}<p class="ork-${id}__note">{{ section.settings.note }}</p>{% endif %}
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:20px;}
.ork-${id}__scroll{overflow-x:auto;border:1px solid #ececf1;border-radius:var(--ork-radius);}
.ork-${id}__table{width:100%;border-collapse:collapse;min-width:480px;background:#fff;}
.ork-${id}__table th,.ork-${id}__table td{padding:13px 16px;border-bottom:1px solid #f0f0f4;text-align:left;}
.ork-${id}__table thead th{background:color-mix(in srgb,var(--ork-accent) 8%,#fff);}
.ork-${id}__note{margin-top:14px;color:#666;font-size:14px;}${fadeCss(id, c.anim)}`;
  const schema = `{% schema %}
{
  "name": "Guide des tailles",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "Guide des tailles" },
    { "type": "textarea", "id": "intro", "label": "Intro / conseils de mesure" },
    { "type": "text", "id": "c1", "label": "Colonne 1", "default": "Taille" },
    { "type": "text", "id": "c2", "label": "Colonne 2", "default": "A (cm)" },
    { "type": "text", "id": "c3", "label": "Colonne 3", "default": "B (cm)" },
    { "type": "text", "id": "note", "label": "Note", "default": "Entre deux tailles, choisissez la plus grande." },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${c.accent}" }
  ],
  "blocks": [ { "type": "row", "name": "Ligne", "settings": [ { "type": "text", "id": "v1", "label": "Col 1", "default": "M" }, { "type": "text", "id": "v2", "label": "Col 2", "default": "00" }, { "type": "text", "id": "v3", "label": "Col 3", "default": "00" } ] } ],
  "max_blocks": 12,
  "presets": [{ "name": "Guide des tailles", "blocks": [ { "type": "row" }, { "type": "row" }, { "type": "row" } ] }]
}
{% endschema %}`;
  return { liquid, css, js: "", schema, needsJs: false };
}

function buildBeforeAfter(c: SecCtx, input: SectionInput): BuiltSection {
  const id = c.id;
  const allowJs = input.allowJs !== false && input.noJsVersion !== true;
  if (!allowJs) {
    // Version SANS JS : double image côte à côte.
    const liquid = `{% comment %} Orkestra — Avant/Après (double image, sans JS) {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal><h2 class="ork-h">{{ section.settings.heading | default: 'Avant / Après' }}</h2></div>
    <div class="ork-${id}__pair">
      <figure>{% if section.settings.before != blank %}<img src="{{ section.settings.before | image_url: width: 800 }}" alt="Avant" width="400" height="400" loading="lazy">{% else %}<div class="ork-${id}__ph"></div>{% endif %}<figcaption>{{ section.settings.before_label | default: 'Avant' }}</figcaption></figure>
      <figure>{% if section.settings.after != blank %}<img src="{{ section.settings.after | image_url: width: 800 }}" alt="Après" width="400" height="400" loading="lazy">{% else %}<div class="ork-${id}__ph"></div>{% endif %}<figcaption>{{ section.settings.after_label | default: 'Après' }}</figcaption></figure>
    </div>
  </div>
</section>`;
    const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:20px;}
.ork-${id}__pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.ork-${id}__pair figure{margin:0;}
.ork-${id}__pair img,.ork-${id}__ph{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--ork-radius);}
.ork-${id}__ph{background:#f1f1f5;}
.ork-${id}__pair figcaption{margin-top:8px;text-align:center;font-weight:600;color:#555;}${fadeCss(id, c.anim)}`;
    const schema = beforeAfterSchema(id, c.accent);
    return { liquid, css, js: "", schema, needsJs: false };
  }
  // Version slider (JS encapsulé).
  const liquid = `{% comment %} Orkestra — Avant/Après (slider) {% endcomment %}
<section class="ork-${id}">
  <div class="ork-wrap">
    <div class="ork-${id}__head" data-ork-reveal><h2 class="ork-h">{{ section.settings.heading | default: 'Avant / Après' }}</h2></div>
    <div class="ork-${id}__ba" data-ork-ba>
      <div class="ork-${id}__img ork-${id}__img--after">{% if section.settings.after != blank %}<img src="{{ section.settings.after | image_url: width: 1200 }}" alt="Après" loading="lazy">{% endif %}<span class="ork-${id}__lbl">{{ section.settings.after_label | default: 'Après' }}</span></div>
      <div class="ork-${id}__img ork-${id}__img--before" data-ork-before>{% if section.settings.before != blank %}<img src="{{ section.settings.before | image_url: width: 1200 }}" alt="Avant" loading="lazy">{% endif %}<span class="ork-${id}__lbl">{{ section.settings.before_label | default: 'Avant' }}</span></div>
      <input class="ork-${id}__range" type="range" min="0" max="100" value="50" aria-label="Comparer avant et après">
      <span class="ork-${id}__handle" aria-hidden="true"></span>
    </div>
  </div>
</section>`;
  const css = `${baseCss(id, c.accent)}
.ork-${id}__head{text-align:center;margin-bottom:20px;}
.ork-${id}__ba{position:relative;max-width:820px;margin:0 auto;aspect-ratio:16/10;border-radius:var(--ork-radius);overflow:hidden;}
.ork-${id}__img{position:absolute;inset:0;}
.ork-${id}__img img{width:100%;height:100%;object-fit:cover;}
.ork-${id}__img--before{width:50%;overflow:hidden;border-right:2px solid #fff;}
.ork-${id}__lbl{position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:3px 8px;border-radius:999px;}
.ork-${id}__img--after .ork-${id}__lbl{left:auto;right:10px;}
.ork-${id}__range{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;}
.ork-${id}__handle{position:absolute;top:0;bottom:0;left:50%;width:2px;background:#fff;transform:translateX(-50%);pointer-events:none;box-shadow:0 0 0 6px rgba(255,255,255,.25);}`;
  const js = `(function(){
  document.querySelectorAll('.ork-${id} [data-ork-ba]').forEach(function(ba){
    var before=ba.querySelector('[data-ork-before]'),range=ba.querySelector('.ork-${id}__range'),handle=ba.querySelector('.ork-${id}__handle');
    function set(v){before.style.width=v+'%';handle.style.left=v+'%';}
    range.addEventListener('input',function(){set(range.value);});set(50);
  });
})();`;
  return { liquid, css, js, schema: beforeAfterSchema(id, c.accent), needsJs: true };
}
function beforeAfterSchema(id: string, accent: string): string {
  return `{% schema %}
{
  "name": "Avant / Après",
  "tag": "section",
  "settings": [
    { "type": "text", "id": "heading", "label": "Titre", "default": "Avant / Après" },
    { "type": "image_picker", "id": "before", "label": "Image avant" },
    { "type": "image_picker", "id": "after", "label": "Image après" },
    { "type": "text", "id": "before_label", "label": "Légende avant", "default": "Avant" },
    { "type": "text", "id": "after_label", "label": "Légende après", "default": "Après" },
    { "type": "color", "id": "accent_color", "label": "Couleur d'accent", "default": "${accent}" }
  ],
  "presets": [{ "name": "Avant / Après" }]
}
{% endschema %}`;
}

// ── Merchant Shield ───────────────────────────────────────────────────────

export interface MerchantContext {
  brandName?: string;
  niche?: string;
  language?: string;
  collections?: string[];
  /** Nombre réel de textes anglais détectés par le scan public. */
  englishCount?: number;
  /** Score Merchant réel issu du scan (override le calcul). */
  scoreHint?: number;
  /** Pages légales essentielles manquantes (libellés). */
  missingLegal?: string[];
}

export function generateMerchantAudit(ctx: MerchantContext = {}): MerchantAudit {
  const lang = ctx.language || "française";
  const cols = ctx.collections?.length ? ctx.collections : ["vos collections"];
  const hasEnglish = ctx.englishCount != null;
  const issues: MerchantAudit["issues"] = [
    {
      id: "m1",
      category: "Pages légales",
      severity: "critique",
      title: "Politique de retour introuvable ou incomplète",
      explanation:
        "Google Merchant Center exige une politique de retour claire et accessible. Son absence est une cause fréquente de suspension.",
      fix: "Ajoutez une page « Politique de retour » détaillée (délai, conditions, frais) et liez-la dans le footer.",
      priority: 1,
      resolved: false,
    },
    {
      id: "m2",
      category: "Cohérence langue",
      severity: "critique",
      title: hasEnglish
        ? `${ctx.englishCount} texte(s) en anglais détecté(s) par le scan`
        : `Textes en anglais détectés sur une boutique ${lang === "française" ? "FR" : lang}`,
      explanation:
        "Des libellés thème en anglais (« Add to cart », « Sold out ») nuisent à la confiance et à la conformité.",
      fix: "Traduisez les libellés via l'éditeur de langue Shopify (Paramètres → Langues → Modifier).",
      priority: 2,
      resolved: false,
    },
    {
      id: "m3",
      category: "Transparence entreprise",
      severity: "important",
      title: "Informations entreprise insuffisantes",
      explanation:
        "Une page « À propos » et des mentions légales complètes rassurent Google et les acheteurs.",
      fix: "Complétez les mentions légales (raison sociale, adresse, contact) et étoffez la page À propos.",
      priority: 3,
      resolved: false,
    },
    {
      id: "m4",
      category: "Contenu produit",
      severity: "important",
      title: `Descriptions trop faibles sur ${cols.slice(0, 2).join(", ")}`,
      explanation:
        `Des descriptions trop courtes ou dupliquées sur ${cols.slice(0, 3).join(", ")} dégradent le SEO et la confiance.`,
      fix: "Générez des fiches produits SEO complètes via le SEO Studio (200+ mots, bénéfices, FAQ).",
      priority: 4,
      resolved: false,
    },
    {
      id: "m5",
      category: "Promotions",
      severity: "mineur",
      title: "Promotions potentiellement agressives",
      explanation:
        "Des réductions « -80% » permanentes peuvent déclencher un signal misrepresentation.",
      fix: "Limitez les promotions dans le temps et affichez des prix de référence cohérents.",
      priority: 5,
      resolved: false,
    },
    {
      id: "m6",
      category: "Page contact",
      severity: "mineur",
      title: "Moyens de contact limités",
      explanation: "Un seul moyen de contact réduit la confiance perçue.",
      fix: "Ajoutez un email, un formulaire et idéalement un délai de réponse annoncé.",
      priority: 6,
      resolved: false,
    },
  ];
  // Score réel du scan si disponible, sinon basé sur la sévérité des problèmes.
  if (ctx.scoreHint != null) {
    return { score: Math.max(20, Math.min(99, Math.round(ctx.scoreHint))), issues };
  }
  const open = issues.filter((i) => !i.resolved);
  const penalty = open.reduce(
    (acc, i) => acc + (i.severity === "critique" ? 18 : i.severity === "important" ? 9 : 3),
    0
  );
  return { score: Math.max(20, 100 - penalty), issues };
}

// ── AI Council ────────────────────────────────────────────────────────────

import type { CouncilProviderAnswer, CouncilScores, SiteReview } from "../types";
import { getPreset, buildReviewIssues, detectNiche, type NicheKey } from "../niche";

const MODE_LABEL: Record<CouncilMode, string> = {
  seo: "SEO e-commerce",
  code: "Code Shopify",
  merchant: "Google Merchant Center",
  email: "Email client",
  quote: "Devis",
  strategy: "Stratégie e-commerce",
  competitive: "Analyse concurrentielle",
  free: "Question libre",
};

export interface CouncilContext {
  brandName?: string;
  niche?: string;
  url?: string;
  positioning?: string;
  country?: string;
  language?: string;
  collections?: string[];
  productTypes?: string[];
  primaryKeywords?: string[];
  secondaryKeywords?: string[];
  competitors?: string[];
  promises?: string[];
  guarantees?: string[];
  formality?: string;
  shippingDelay?: string;
  returnPolicy?: string;
  /** Données réelles issues du scan public (si une analyse existe). */
  englishCount?: number;
  missingLegal?: string[];
  legalFound?: string[];
  merchantScore?: number;
  pagesAnalyzed?: number;
  productsFound?: number;
  productsAnalyzed?: number;
  productsEnriched?: number;
  weakDescriptions?: number;
  weakTitles?: number;
  collectionsFound?: number;
  coverage?: string;
  catalogSource?: string;
  collectionsAnalyzed?: number;
  noType?: number;
  tagsCoverage?: number;
  topTypes?: string[];
  missingMeta?: number;
  imagesNoAlt?: number;
  priorityProducts?: { title: string; reason: string; contentScore: number }[];
  issuesSummary?: string[];
  scoresSummary?: string;
  /** Liste structurée des textes anglais détectés (pour le drill-down). */
  englishList?: { text: string; suggestion: string; source: string; impact: string }[];
  /** Problèmes détectés structurés (drill-down). */
  problems?: { area: string; severity: string; impact: string; fix: string; module: string }[];
  /** Historique de conversation (provider-agnostique). */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Question précédente, pour la continuité de conversation. */
  previousQuestion?: string;
  /** Directive issue d'un bouton d'action. */
  directive?: "improve" | "shorten" | "premium" | "html" | null;
}

// Helpers d'accès aux données boutique (avec repli générique si vide).
function brandOf(ctx: CouncilContext): string {
  return ctx.brandName || "votre boutique";
}
function collectionsOf(ctx: CouncilContext): string[] {
  return ctx.collections?.length ? ctx.collections : ["vos collections principales"];
}
function productsOf(ctx: CouncilContext): string[] {
  return ctx.productTypes?.length ? ctx.productTypes : ["vos produits phares"];
}
function keywordsOf(ctx: CouncilContext): string[] {
  return ctx.primaryKeywords?.length ? ctx.primaryKeywords : ["vos mots-clés principaux"];
}
function nicheOf(ctx: CouncilContext): string {
  return ctx.niche || "votre niche";
}

// Spécialités, forces et limites de chaque IA (utilisées dans les onglets).
const PROVIDER_PROFILE: Record<
  AIProviderId,
  { specialty: string; strengths: string[]; limits: string[]; bias: number }
> = {
  openai: {
    specialty: "Exécution & structure opérationnelle",
    strengths: ["Plans d'action clairs et ordonnés", "Très bon sur les checklists et priorisation"],
    limits: ["Style parfois générique", "Peut manquer de finesse rédactionnelle"],
    bias: 6,
  },
  anthropic: {
    specialty: "Rédaction premium & nuance",
    strengths: ["Ton de marque naturel et premium", "Excellentes explications pédagogiques"],
    limits: ["Réponses parfois plus longues", "Moins orienté chiffres bruts"],
    bias: 8,
  },
  gemini: {
    specialty: "Analyse, recherche & conformité",
    strengths: ["Bon sur la conformité Merchant Center", "Approche analytique et data"],
    limits: ["Mise en forme parfois irrégulière", "Style moins commercial"],
    bias: 4,
  },
  openrouter: {
    specialty: "Polyvalence multi-modèles",
    strengths: ["Variante rapide et alternative", "Bon rapport vitesse/qualité"],
    limits: ["Qualité dépend du modèle routé", "Moins prévisible"],
    bias: 2,
  },
  mistral: {
    specialty: "Rapidité & efficacité technique",
    strengths: ["Réponses concises et efficaces", "Très bon en français"],
    limits: ["Moins de profondeur sur les sujets complexes", "Peu de nuances stratégiques"],
    bias: 1,
  },
};

export function generateCouncil(
  mode: CouncilMode,
  question: string,
  providers: AIProviderId[],
  ctx: CouncilContext = {}
): CouncilResult {
  const active = providers.length ? providers : (["openai"] as AIProviderId[]);

  // Une demande de review/analyse de site déclenche une analyse complète.
  const reviewIntent = isReviewIntent(question);
  const sr = reviewIntent ? buildSiteReview(ctx) : null;

  // Réponse finale fusionnée, riche et structurée (markdown).
  const baseMarkdown = sr ? sr.markdown : buildFinalAnswer(mode, question, ctx);
  const finalAnswer = applyDirective(baseMarkdown, ctx.directive);

  const providerAnswers: CouncilProviderAnswer[] = active.map((p) => {
    const profile = PROVIDER_PROFILE[p];
    return {
      provider: p,
      model: defaultModelFor(p),
      specialty: profile.specialty,
      answer: buildProviderAnswer(p, ctx, baseMarkdown),
      qualityScore: 78 + profile.bias + (mode === "seo" || reviewIntent ? 3 : 0),
      strengths: profile.strengths,
      limits: profile.limits,
    };
  });

  const best = [...providerAnswers].sort((a, b) => b.qualityScore - a.qualityScore)[0];
  const quality = Math.min(98, (best?.qualityScore ?? 84) + 5 + Math.min(active.length, 4));

  const scores: CouncilScores = {
    quality,
    clarity: Math.min(98, quality - 2),
    actionable: Math.min(99, quality + 1),
    seo: mode === "seo" || reviewIntent ? Math.min(96, quality - 4) : undefined,
  };

  const nextActions = sr
    ? ["Corriger les collections (SEO Studio)", "Lancer Merchant Shield", "Réordonner la page d'accueil (Section Builder)"]
    : nextActionsFor(mode);

  return {
    finalAnswer,
    qualityScore: quality,
    scores,
    timeSaved: sr ? "~4 h d'audit manuel" : estimateTimeSaved(mode),
    modelsUsed: active,
    nextActions,
    synthesisReasons: [
      `${active.length} IA interrogée${active.length > 1 ? "s" : ""} en parallèle puis fusionnée${active.length > 1 ? "s" : ""}.`,
      sr
        ? "Analyse complète du site croisée avec les données de votre boutique."
        : `Structure la plus complète retenue pour le mode « ${MODE_LABEL[mode]} ».`,
      "Contradictions arbitrées en faveur des bonnes pratiques e-commerce Shopify.",
      ctx.previousQuestion ? "Contexte de la question précédente conservé." : "Ton aligné sur la mémoire boutique.",
    ],
    providerAnswers,
    review: sr?.review,
  };
}

function defaultModelFor(p: AIProviderId): string {
  const map: Record<AIProviderId, string> = {
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4-6",
    gemini: "gemini-1.5-pro",
    openrouter: "openrouter/auto",
    mistral: "mistral-large-latest",
  };
  return map[p];
}

function estimateTimeSaved(mode: CouncilMode): string {
  const map: Record<CouncilMode, string> = {
    seo: "~3 h de travail SEO",
    code: "~2 h de dev front",
    merchant: "~2 h 30 d'audit",
    email: "~25 min de rédaction",
    quote: "~40 min de devis",
    strategy: "~4 h de cadrage",
    competitive: "~3 h de veille",
    free: "~1 h de recherche",
  };
  return map[mode];
}

function nextActionsFor(mode: CouncilMode): string[] {
  const map: Record<CouncilMode, string[]> = {
    seo: ["Générer 3 fiches produits dans le SEO Studio", "Optimiser les meta des collections", "Lancer Merchant Shield"],
    code: ["Générer la section dans le Section Builder", "Tester le rendu mobile", "Ajouter les settings au customizer"],
    merchant: ["Lancer un audit complet Merchant Shield", "Corriger les pages légales", "Traduire les libellés EN"],
    email: ["Dupliquer comme modèle d'email", "Adapter le ton de marque", "Ajouter un CTA mesurable"],
    quote: ["Exporter le devis en HTML", "Ajouter vos conditions de vente", "Personnaliser par client"],
    strategy: ["Construire le plan d'action 30 jours", "Prioriser par impact/effort", "Définir les KPIs"],
    competitive: ["Lister 3 concurrents dans la Mémoire boutique", "Identifier vos angles différenciants", "Adapter le SEO"],
    free: ["Affiner la question", "Demander un plan d'action", "Générer le contenu associé"],
  };
  return map[mode];
}

// ── Construction de la réponse finale (markdown structuré) ──────────────────

/** Bandeau commun : Mode utilisé · Données utilisées · Limite. */
function modeBanner(mode: CouncilMode, ctx: CouncilContext): string {
  const data: string[] = [];
  if (ctx.productsFound != null) data.push("scan public");
  if (ctx.collections?.length) data.push("collections détectées");
  if (ctx.productsEnriched) data.push("produits enrichis (products.json)");
  if (ctx.priorityProducts?.length) data.push("produits prioritaires");
  if (ctx.legalFound?.length || ctx.missingLegal?.length) data.push("pages légales");
  const list = data.length ? data.join(", ") : "mémoire boutique";
  return `> **Mode : ${MODE_LABEL[mode]}** · Données utilisées : ${list} · Limite : analyse basée sur la vue publique (API Shopify non connectée).\n\n`;
}

function buildFinalAnswer(mode: CouncilMode, question: string, ctx: CouncilContext): string {
  // Question de suivi → réponse courte et ciblée (pas de ré-audit complet).
  if (isFollowupQuestion(question, ctx) && !isReviewIntent(question)) {
    return modeBanner(mode, ctx) + answerFollowup(mode, question, ctx);
  }
  const isPlan = /30\s*jours?|plan d'action|planning|roadmap|sur 30/i.test(question);
  switch (mode) {
    case "seo":
      return modeBanner(mode, ctx) + (isPlan ? seoPlan30(ctx) : seoAnswer(ctx));
    case "code":
      return modeBanner(mode, ctx) + codeAnswer(ctx, question);
    case "merchant":
      return modeBanner(mode, ctx) + merchantAnswer(ctx);
    case "email":
      return modeBanner(mode, ctx) + emailAnswer(ctx, question);
    case "quote":
      return modeBanner(mode, ctx) + quoteAnswer(ctx, question);
    case "strategy":
      return modeBanner(mode, ctx) + (isPlan ? strategyPlan30(ctx) : strategyAnswer(ctx));
    case "competitive":
      return modeBanner(mode, ctx) + competitiveAnswer(ctx);
    default:
      return freeAnswer(question, ctx);
  }
}

/** Détection d'intention pour le mode « Question libre » → route vers le bon expert. */
function detectIntent(q: string): CouncilMode {
  const t = q.toLowerCase();
  if (/\b(merchant|google ads|google shopping|shopping|suspend|bannis|conformit|misrepresentation)\b/.test(t)) return "merchant";
  if (/\b(code|liquid|section|css|theme|thème|bouton|hero|faq|réassurance|reassurance|comparatif|sticky|avis|page produit|customizer)\b/.test(t)) return "code";
  if (/\b(email|e-mail|mail|client|sav|réclamation|reclamation|relance|retard|remboursement|répondre au client)\b/.test(t)) return "email";
  if (/\b(devis|quote|cotation|b2b|sur mesure|sur-mesure|remise volume)\b/.test(t)) return "quote";
  if (/\b(stratégie|strategie|croissance|growth|business|roadmap|scaler|développer|chiffre d'affaires|ca\b)\b/.test(t)) return "strategy";
  if (/\b(concurrent|concurrence|compétiteur|competiteur|marché|benchmark)\b/.test(t)) return "competitive";
  if (/\b(seo|référencement|referencement|mot-?clé|mot-?cle|meta|ranking|google|collection|maillage|longue traîne|backlink)\b/.test(t)) return "seo";
  return "free";
}

// ── Conversation / follow-up (logique commune à toutes les IA) ──────────────

/** Une question est-elle un suivi du message précédent ? */
export function isFollowupQuestion(question: string, ctx: CouncilContext): boolean {
  if (!ctx.history?.length) return false;
  const q = question.trim().toLowerCase();
  if (q.split(/\s+/).length <= 6) return true; // question courte → suivi probable
  return /\b(où|ou ça|quel|quels|quelle|c'est grave|comment corriger|donne|fais|juste|celui|celle|ça|cela|ce mot|le mot|cette|ces|résume|resume|plus court|plus premium|version|et pour|et le|et la)\b/i.test(q);
}

export type FollowupTopic =
  | "english" | "meta" | "products" | "collections" | "alt" | "legal"
  | "where" | "severity" | "code" | "plan" | "shorten" | "premium" | "generic";

export function followupTopic(question: string): FollowupTopic {
  const t = question.toLowerCase();
  if (/anglais|english|mot.*(traduire|corriger)|traduire/.test(t)) return "english";
  if (/meta|title|balise/.test(t)) return "meta";
  if (/produit|fiche|article/.test(t)) return "products";
  if (/collection|catégorie|categorie/.test(t)) return "collections";
  if (/alt|image/.test(t)) return "alt";
  if (/légal|legal|mention|cgv|confidential|retour|livraison|contact|garantie/.test(t)) return "legal";
  if (/où|chemin|dans shopify|admin|trouver/.test(t)) return "where";
  if (/grave|important|risque|priorit/.test(t)) return "severity";
  if (/code|liquid|section|css/.test(t)) return "code";
  if (/plan|7 jours|30 jours|roadmap|résume|resume/.test(t)) return "plan";
  if (/plus court|raccourci|résume|resume/.test(t)) return "shorten";
  if (/premium|améliore|ameliore|mieux/.test(t)) return "premium";
  return "generic";
}

/** Chemin Shopify probable selon le sujet. */
function shopifyPath(topic: FollowupTopic): string {
  switch (topic) {
    case "english": return "Admin Shopify → Paramètres → Langues → (langue) → Modifier les traductions du thème.";
    case "meta": return "Admin → la page/collection/produit → section « Référencement sur les moteurs de recherche » → Modifier.";
    case "alt": return "Admin → Contenu → Fichiers (ou la fiche produit → image → Modifier le texte alternatif).";
    case "legal": return "Admin → Boutique en ligne → Pages (créer/éditer) puis lier dans Paramètres → Navigation (footer).";
    case "code": return "Admin → Boutique en ligne → Thèmes → ⋯ → Modifier le code → Sections.";
    default: return "Admin Shopify → la section concernée.";
  }
}

/** Réponse COURTE et CIBLÉE à une question de suivi (mock). Pas de ré-audit. */
function answerFollowup(mode: CouncilMode, question: string, ctx: CouncilContext): string {
  const topic = followupTopic(question);
  const s = brandOf(ctx);

  if (topic === "english") {
    const list = ctx.englishList ?? [];
    if (!list.length) {
      return `## Textes anglais détectés\n${ctx.englishCount ? `Le scan a détecté **${ctx.englishCount}** libellé(s) anglais, mais le détail exact n'est pas disponible (relancez un scan public pour les extraire).` : "_Donnée non disponible via scan public._"}\n\n**Où corriger** : ${shopifyPath("english")}\n**Module** : Merchant Shield.`;
    }
    return `## Textes anglais à corriger (${list.length})
${list.slice(0, 8).map((e) => `- **« ${e.text} »** → « ${e.suggestion} » · source : ${e.source} · impact : ${e.impact}`).join("\n")}

**Où corriger** : ${shopifyPath("english")}
**Action Orkestra** : Merchant Shield → générer les corrections de langue.`;
  }

  if (topic === "products") {
    const p = ctx.priorityProducts ?? [];
    if (!p.length) return `_Aucun produit prioritaire isolé via le scan public. Élargissez le scan ou connectez l'API Shopify._`;
    return `## Produits concernés (${p.length})
${p.slice(0, 6).map((x, i) => `${i + 1}. **${x.title}** — ${x.reason.toLowerCase()} (contenu ${x.contentScore}/100).`).join("\n")}

**Action** : ouvrez le **SEO Studio** (pré-rempli depuis ces produits) pour enrichir description + FAQ + alt text.`;
  }

  if (topic === "collections") {
    const cols = ctx.collections ?? [];
    return cols.length
      ? `## Collections concernées\n${cols.slice(0, 8).map((c) => `- ${c}`).join("\n")}\n\n**Action** : texte SEO + FAQ par collection (SEO Studio).`
      : `_Aucune collection détectée via le scan public._`;
  }

  if (topic === "meta") {
    return `## Meta à corriger\n${ctx.missingMeta != null ? `**${ctx.missingMeta}** meta manquantes détectées (échantillon).` : "_Nombre exact non disponible via scan public._"}\n\nExemple prêt à coller : \`Découvrez nos ${(ctx.collections?.[0] || "produits").toLowerCase()} — sélection premium, livraison gratuite.\` (≤ 155 car.)\n**Où** : ${shopifyPath("meta")}`;
  }

  if (topic === "alt") {
    return `## Images sans alt text\n${ctx.imagesNoAlt != null ? `**${ctx.imagesNoAlt}** images sans alt détectées.` : "_Nombre non disponible._"}\nExemple d'alt : « ${(ctx.collections?.[0] || "produit").toLowerCase()} — ${nicheOf(ctx)} ».\n**Où** : ${shopifyPath("alt")}`;
  }

  if (topic === "legal") {
    const missing = ctx.missingLegal ?? [];
    return missing.length
      ? `## Pages légales manquantes\n${missing.map((m) => `- ${m}`).join("\n")}\n\n**Où** : ${shopifyPath("legal")}\n**Module** : Merchant Shield.`
      : `## Pages légales\nAucune page essentielle manquante détectée${ctx.legalFound?.length ? ` (présentes : ${ctx.legalFound.join(", ")})` : ""}.`;
  }

  if (topic === "where") {
    // Devine le sujet précédent depuis l'historique.
    const prev = ctx.history?.slice().reverse().find((h) => h.role === "assistant")?.content || "";
    const sub: FollowupTopic = /anglais/i.test(prev) ? "english" : /meta/i.test(prev) ? "meta" : /alt|image/i.test(prev) ? "alt" : /légal|legal|retour|livraison/i.test(prev) ? "legal" : "code";
    return `## Où dans Shopify\n${shopifyPath(sub)}`;
  }

  if (topic === "severity") {
    return `## Niveau de gravité\nPriorités à fort impact : ${ctx.weakDescriptions ? `**${ctx.weakDescriptions} descriptions faibles** (SEO/conversion)` : "contenu"}, ${ctx.englishCount ? `**${ctx.englishCount} textes anglais** (confiance/Merchant)` : "langue"}, pages légales manquantes${ctx.missingLegal?.length ? ` (${ctx.missingLegal.join(", ")})` : ""}. Le reste (alt text, tags) est secondaire.`;
  }

  if (topic === "code") {
    return codeAnswer(ctx, question); // génère le code ciblé
  }

  if (topic === "plan") {
    const cols = ctx.collections ?? [];
    return `## Plan 7 jours (ciblé)
- **J1** : corriger ${ctx.englishCount ?? 0} textes anglais + ${ctx.missingMeta ?? 0} meta manquantes.
- **J2** : product_type manquants (${ctx.noType ?? 0}).
- **J3–4** : texte SEO + FAQ sur « ${cols[0] || "collection principale"} »${cols[1] ? " et « " + cols[1] + " »" : ""}.
- **J5–7** : enrichir les produits prioritaires (SEO Studio).`;
  }

  // generic / shorten / premium : réponse courte contextualisée
  return `## Réponse ciblée\nConcernant « ${question.trim().slice(0, 100)} » pour ${s} : je réponds directement à ce point sans refaire l'audit complet.\n- ${ctx.englishCount ? `Textes anglais : ${ctx.englishCount} détecté(s).` : ""} ${ctx.weakDescriptions ? `Fiches faibles : ${ctx.weakDescriptions}.` : ""} ${ctx.missingMeta ? `Meta manquantes : ${ctx.missingMeta}.` : ""}\n> Précisez le point (meta, anglais, produits, collections, code…) pour une réponse encore plus directe.`;
}

/** Détecte une demande de review/analyse complète de site. */
export function isReviewIntent(question: string): boolean {
  return /\b(review|revue|analyse[rz]?|audit|passe[rz]?\s+en\s+revue|diagnosti)/i.test(question) &&
    /\b(site|boutique|shop|store|page d'accueil|home)\b/i.test(question);
}

function scanContextLine(ctx: CouncilContext): string {
  if (ctx.productsFound == null) return "";
  const enriched = ctx.productsEnriched ? ` · ${ctx.productsEnriched} enrichis via products.json` : "";
  const weak = ctx.weakDescriptions ? ` ${ctx.weakDescriptions} fiche(s) ont une description faible.` : "";
  return `> 📊 Scan : ${ctx.productsFound} produit(s) trouvés${enriched} · ${ctx.productsAnalyzed ?? 0} analysés en HTML${ctx.catalogSource ? ` (source ${ctx.catalogSource}` : ""}${ctx.catalogSource ? `, couverture ${ctx.coverage ?? "n/a"})` : ""}.${weak}\n\n`;
}

// Vocabulaire spécifique par niche (pour des corrections concrètes).
interface NicheVocab {
  pieces: string[];
  faqs: (coll: string) => string[];
  descHints: string;
}
function nicheVocab(key: NicheKey): NicheVocab {
  // Les noms de collections sont au pluriel (« Suspensions ») → on emploie le
  // pluriel possessif (« vos suspensions ») pour éviter tout article singulier
  // genré incorrect (« un suspension »).
  const map: Partial<Record<NicheKey, NicheVocab>> = {
    luminaires: {
      pieces: ["salon", "salle à manger", "cuisine", "chambre", "escalier"],
      faqs: (c) => [
        `Quel modèle de ${c.toLowerCase()} choisir selon la pièce (salon, salle à manger, chambre) ?`,
        `À quelle hauteur installer vos ${c.toLowerCase()} ?`,
        `Quel type d'ampoule privilégier pour vos ${c.toLowerCase()} (LED, culot, intensité) ?`,
      ],
      descHints: "matériau, dimensions, hauteur d'installation, type d'ampoule, pièce (salon/chambre/cuisine), style déco et ambiance lumineuse",
    },
    beaute: {
      pieces: ["peau sèche", "peau grasse", "peau sensible"],
      faqs: (c) => [
        `Pour quel type de peau vos ${c.toLowerCase()} sont-ils adaptés ?`,
        `Comment intégrer ces ${c.toLowerCase()} dans une routine ?`,
        `Quels sont les ingrédients clés et leurs bénéfices ?`,
      ],
      descHints: "ingrédients/actifs, type de peau, mode d'emploi, routine, bénéfices et résultats",
    },
    bebe: {
      pieces: ["0-6 mois", "6-12 mois", "1-3 ans"],
      faqs: (c) => [
        `À partir de quel âge utiliser vos ${c.toLowerCase()} ?`,
        `Vos ${c.toLowerCase()} respectent-ils les normes de sécurité ?`,
        `Comment les entretenir / les nettoyer ?`,
      ],
      descHints: "âge recommandé, normes de sécurité, matériaux (coton bio…), confort et entretien",
    },
    mode: {
      pieces: ["décontracté", "soirée", "bureau"],
      faqs: (c) => [
        `Comment choisir sa taille pour vos ${c.toLowerCase()} ?`,
        `Quelle matière pour vos ${c.toLowerCase()} et comment les entretenir ?`,
        `Comment associer vos ${c.toLowerCase()} (idées de looks) ?`,
      ],
      descHints: "guide des tailles, matière, coupe, entretien et idées de looks",
    },
  };
  return (
    map[key] ?? {
      pieces: ["usage quotidien"],
      faqs: (c) => [
        `Comment bien choisir parmi vos ${c.toLowerCase()} ?`,
        `Quelles sont les caractéristiques importantes à comparer ?`,
        `Quels sont les délais de livraison et la politique de retour ?`,
      ],
      descHints: "bénéfices, caractéristiques, dimensions, usage et entretien",
    }
  );
}

/** Bloc de correction concrète prêt à coller pour une collection. */
function productAction(reason: string, vocab: NicheVocab): string {
  const r = reason.toLowerCase();
  if (r.includes("type")) return `renseigner le **product_type** + enrichir la description (${vocab.descHints}) et ajouter une FAQ`;
  if (r.includes("description") && r.includes("absente")) return `rédiger une description **200+ mots** (${vocab.descHints}) + FAQ + alt text`;
  if (r.includes("description")) return `étoffer la description à **200+ mots** (${vocab.descHints}) + ajouter une FAQ`;
  if (r.includes("titre")) return `réécrire le titre avec mot-clé + usage/pièce (ex. « pour ${vocab.pieces[0]} »)`;
  if (r.includes("tag")) return `ajouter des tags cohérents (style, ${vocab.pieces.slice(0, 2).join(", ")}, matériau)`;
  return `compléter alt text des images + enrichir la fiche (${vocab.descHints})`;
}

function dataUsed(ctx: CouncilContext): string[] {
  const d: string[] = [];
  if (ctx.productsFound != null) d.push(`${ctx.productsFound} produits trouvés · ${ctx.productsEnriched ?? 0} enrichis · ${ctx.productsAnalyzed ?? 0} analysés HTML`);
  if (ctx.collectionsFound != null) d.push(`${ctx.collectionsFound} collections trouvées · ${ctx.collectionsAnalyzed ?? 0} analysées`);
  if (ctx.weakDescriptions != null) d.push(`${ctx.weakDescriptions} fiches à description faible`);
  if (ctx.weakTitles != null) d.push(`${ctx.weakTitles} titres faibles`);
  if (ctx.noType != null) d.push(`${ctx.noType} produits sans type`);
  if (ctx.tagsCoverage != null) d.push(`tags exploités sur ${ctx.tagsCoverage}% du catalogue`);
  if (ctx.missingMeta != null) d.push(`${ctx.missingMeta} meta descriptions manquantes (échantillon)`);
  if (ctx.imagesNoAlt != null) d.push(`${ctx.imagesNoAlt} images sans alt text`);
  if (ctx.englishCount != null) d.push(`${ctx.englishCount} textes anglais détectés`);
  if (ctx.missingLegal?.length) d.push(`pages légales manquantes : ${ctx.missingLegal.join(", ")}`);
  if (ctx.scoresSummary) d.push(ctx.scoresSummary);
  if (ctx.coverage) d.push(`couverture du scan : ${ctx.coverage}`);
  return d;
}

function seoAnswer(ctx: CouncilContext): string {
  // Si on a les données du scan → audit data-driven. Sinon → version générique.
  return ctx.productsFound != null ? dataDrivenSeoAudit(ctx) : seoAnswerGeneric(ctx);
}

function singularize(s: string): string {
  const words = s.trim().split(" ");
  words[0] = words[0].replace(/(s|x)$/i, "");
  return words.join(" ").toLowerCase();
}

/** Stratégie mots-clés adaptée à la niche, dérivée des collections réelles. */
function nicheKeywords(
  key: NicheKey,
  vocab: NicheVocab,
  cols: string[]
): { short: string[]; transactional: string[]; longtail: string[]; blog: string[]; faq: string[] } {
  const sing = cols.map(singularize);
  const short = key === "luminaires"
    ? ["lustre", "suspension", "plafonnier", "lampe de chevet", "luminaire"]
    : (sing.length ? sing : ["votre catégorie"]).slice(0, 5);
  const transactional = cols.slice(0, 4).flatMap((c) => [`acheter ${c.toLowerCase()}`, `${c.toLowerCase()} design`]);
  const piece = vocab.pieces;
  let longtail: string[] = [];
  if (key === "luminaires") {
    longtail = [
      `${sing[0] || "suspension"} salle à manger design`,
      `hauteur ${sing[0] || "suspension"} salle à manger`,
      "quel plafonnier pour une chambre",
      "luminaire escalier haut plafond",
      "lustre moderne salon contemporain",
    ];
  } else {
    longtail = (sing.length ? sing : ["produit"]).slice(0, 3).flatMap((x) => [`comment choisir ${x}`, `meilleur ${x} ${new Date().getFullYear()}`]);
  }
  longtail = [...longtail, ...cols.slice(0, 3).map((c) => `${c.toLowerCase()} pour ${piece[0]}`)].slice(0, 9);
  const blog = (cols.length ? cols : ["votre collection"]).slice(0, 3).map((c) => `Guide : comment choisir ${singularize(c)}`);
  const faq = vocab.faqs(cols[0] || "produits");
  return { short, transactional, longtail, blog, faq };
}

/** Bloc SEO complet pour UNE collection réelle (proposition prête à coller). */
function collectionSeoBlock(ctx: CouncilContext, coll: string, vocab: NicheVocab, others: string[]): string {
  const s = brandOf(ctx);
  const sing = singularize(coll);
  const faqs = vocab.faqs(coll);
  const secondary = vocab.pieces.slice(0, 3).map((p) => `${sing} ${p}`);
  const internal = others.filter((c) => c !== coll).slice(0, 3);
  return `**📁 Collection « ${coll} »**
- *Problème probable* : texte SEO d'introduction et FAQ absents (à confirmer page par page — donnée partielle via scan public).
- *Mot-clé principal* : \`${sing}\`
- *Mots-clés secondaires* : ${secondary.map((k) => `\`${k}\``).join(", ")}
- *Title proposé* : \`${coll} ${vocab.pieces[0] ? "— " + vocab.pieces[0] : ""} | ${s}\` (≤ 60 car.)
- *Meta proposée* : \`Découvrez nos ${coll.toLowerCase()} pour ${vocab.pieces.slice(0, 3).join(", ")}. Sélection premium, livraison gratuite.\` (≤ 155 car.)
- *Texte SEO (150–300 mots)* : intro (bénéfice + ${vocab.descHints.split(",").slice(0, 2).join(",")}) → **H2 « Comment bien choisir vos ${coll.toLowerCase()} »** → **H2 « Nos best-sellers »** → bloc FAQ.
- *FAQ (4–6)* :
  - ${faqs[0]}
  - ${faqs[1]}
  - ${faqs[2]}
  - Quelle garantie et quels délais de livraison ?
- *Maillage interne à ajouter* : ${internal.length ? internal.map((c) => `lien vers « ${c} » (ancre « ${singularize(c)} ${vocab.pieces[0]} »)`).join(" ; ") : "vers les collections complémentaires une fois détectées"}.`;
}

/** Bloc SEO pour UN produit prioritaire réel. */
function productSeoBlock(p: { title: string; reason: string; contentScore: number }, vocab: NicheVocab): string {
  const target = singularize(p.title.split(" ").slice(0, 4).join(" "));
  return `**🛍️ ${p.title}** (score contenu ${p.contentScore}/100)
- *Problème* : ${p.reason.toLowerCase()}.
- *Mot-clé cible* : \`${target}\`
- *Correction* : ${productAction(p.reason, vocab)}.
- *Alt text proposé* : « ${p.title} — ${vocab.pieces[0]} ».
- *FAQ produit* : « ${vocab.faqs(p.title)[0]} » ; « Quels sont les délais de livraison et la garantie ? »
- *Action* : ouvrir le **SEO Studio** (pré-rempli depuis ce produit) → générer description 200+ mots + FAQ + meta + alt text.`;
}

/** Matrice de maillage interne à partir des collections réelles. */
function maillageBlock(cols: string[], vocab: NicheVocab): string {
  if (cols.length < 2) return "_Maillage interne : au moins 2 collections détectées sont nécessaires (donnée partielle via scan public)._";
  const rows: string[] = ["| Source | Cible | Ancre | Impact |", "|---|---|---|---|"];
  for (let i = 0; i < Math.min(cols.length, 4); i++) {
    const src = cols[i];
    const dst = cols[(i + 1) % cols.length];
    rows.push(`| ${src} | ${dst} | « ${singularize(dst)} ${vocab.pieces[0] || ""} » | Renforce le cocon sémantique ${vocab.pieces[0] ? "(" + vocab.pieces[0] + ")" : ""} |`);
  }
  return rows.join("\n");
}

/** Corrections prêtes à copier (2 meta, 2 titles, 3 FAQ, 3 alt, 3 ancres). */
function readyToCopyBlock(ctx: CouncilContext, cols: string[], vocab: NicheVocab): string {
  const s = brandOf(ctx);
  const c0 = cols[0] || "Collection";
  const c1 = cols[1] || cols[0] || "Collection";
  const faqs = vocab.faqs(c0);
  return `**Titles**
- \`${c0} ${vocab.pieces[0] ? "— " + vocab.pieces[0] : ""} | ${s}\`
- \`${c1} design ${vocab.pieces[1] ? "pour " + vocab.pieces[1] : ""} | ${s}\`

**Meta descriptions**
- \`Découvrez nos ${c0.toLowerCase()} pour ${vocab.pieces.slice(0, 3).join(", ")}. Sélection premium, livraison gratuite.\`
- \`Nos ${c1.toLowerCase()} au meilleur rapport qualité/prix. Conseils d'expert, paiement sécurisé et retours simplifiés.\`

**FAQ**
- ${faqs[0]}
- ${faqs[1]}
- ${faqs[2]}

**Alt text**
- « ${singularize(c0)} ${vocab.pieces[0]} — ${s} »
- « ${singularize(c1)} design ${vocab.pieces[1] || ""} »
- « ambiance ${vocab.pieces[0]} avec ${singularize(c0)} »

**Ancres de maillage**
- « ${singularize(c1)} ${vocab.pieces[0]} » (vers « ${c1} »)
- « nos ${c0.toLowerCase()} » (depuis une fiche produit)
- « guide : comment choisir ${singularize(c0)} » (depuis un article de blog)`;
}

function dataDrivenSeoAudit(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const niche = nicheOf(ctx);
  const key = detectNiche(`${ctx.niche ?? ""} ${ctx.brandName ?? ""}`);
  const vocab = nicheVocab(key);
  // « Ne pas inventer » : on n'utilise que les données réellement détectées.
  const realCols = ctx.collections?.length ? ctx.collections : [];
  const cols = realCols.length ? realCols : collectionsOf(ctx);
  const prio = ctx.priorityProducts ?? [];
  const kw = nicheKeywords(key, vocab, realCols);

  // Priorités par impact.
  const high: string[] = [];
  const mid: string[] = [];
  const low: string[] = [];
  if (ctx.weakDescriptions) high.push(`Enrichir les **${ctx.weakDescriptions} fiches** à description faible (commencer par les best-sellers).`);
  if (realCols.length) high.push(`Ajouter texte SEO + FAQ sur les collections : ${realCols.slice(0, 4).join(", ")}.`);
  if (ctx.missingMeta) high.push(`Réécrire les **${ctx.missingMeta} meta descriptions** manquantes.`);
  if (ctx.noType) mid.push(`Renseigner le \`product_type\` sur **${ctx.noType} produits** (catégorisation + flux Shopping).`);
  if (ctx.imagesNoAlt) mid.push(`Ajouter les alt text sur **${ctx.imagesNoAlt} images**.`);
  mid.push("Mettre en place le maillage interne collection ↔ collection (voir matrice).");
  if (ctx.tagsCoverage != null && ctx.tagsCoverage < 60) low.push(`Améliorer les tags (couverture actuelle ${ctx.tagsCoverage}%).`);
  low.push("Créer un cluster blog (guides d'achat) relié aux collections.");
  if (ctx.englishCount) high.push(`Traduire les **${ctx.englishCount} textes anglais** (confiance + cohérence).`);

  const colBlocks = realCols.length
    ? realCols.slice(0, 3).map((c) => collectionSeoBlock(ctx, c, vocab, realCols)).join("\n\n")
    : "_Donnée non disponible via scan public : aucune collection détectée. Une connexion API Shopify permettra l'analyse collection par collection._";
  const prodBlocks = prio.length
    ? prio.slice(0, 5).map((p) => productSeoBlock(p, vocab)).join("\n\n")
    : "_Donnée non disponible via scan public : aucun produit prioritaire isolé. Élargissez le scan ou connectez l'API Shopify._";

  return `## 🎯 Stratégie SEO de ${s} — mission complète basée sur le scan

${scanContextLine(ctx)}**Analyse basée sur le scan.** Niche : **${niche}**. Objectif : mieux ranker collections + produits, capter la longue traîne, renforcer le maillage interne et réduire les problèmes visibles.

## 1. 📊 Résumé du scan SEO
${dataUsed(ctx).map((d) => `- ${d}`).join("\n")}

## 2. 🥇 Priorités SEO par impact
**Priorité haute**
${high.map((x) => `- ${x}`).join("\n") || "- (rien de bloquant détecté)"}

**Priorité moyenne**
${mid.map((x) => `- ${x}`).join("\n")}

**Priorité basse**
${low.map((x) => `- ${x}`).join("\n")}

## 3. 📁 Collections à optimiser
${colBlocks}

## 4. 🛍️ Produits à optimiser
${prodBlocks}

## 5. 🔗 Maillage interne recommandé
${maillageBlock(realCols, vocab)}

> Règle : chaque fiche produit doit lier vers sa collection ; chaque collection vers 2–3 collections complémentaires ; chaque article de blog vers la collection cible.

## 6. 🔑 Stratégie mots-clés
- **Courte traîne** : ${kw.short.map((k) => `\`${k}\``).join(", ")}
- **Transactionnels** : ${kw.transactional.map((k) => `\`${k}\``).join(", ")}
- **Longue traîne** : ${kw.longtail.map((k) => `\`${k}\``).join(", ")}
- **Blog** : ${kw.blog.map((k) => `« ${k} »`).join(", ")}
- **FAQ** : ${kw.faq.map((k) => `« ${k} »`).join(" ")}

## 7. 🗓️ Plan d'action 7 jours
- **J1** : traduire les textes anglais (${ctx.englishCount ?? 0}) + corriger les meta manquantes (${ctx.missingMeta ?? 0}).
- **J2** : renseigner les \`product_type\` manquants (${ctx.noType ?? 0}).
- **J3–4** : réécrire title + meta + intro SEO + FAQ de « ${cols[0] || "votre collection principale"} »${cols[1] ? " et « " + cols[1] + " »" : ""}.
- **J5–6** : enrichir les 5 produits prioritaires (description 200+ mots, FAQ, alt text) via le SEO Studio.
- **J7** : poser le maillage interne entre ${realCols.slice(0, 3).join(" ↔ ") || "vos collections"}.

## 8. 🗓️ Plan d'action 30 jours
- **Semaine 1** : quick wins (langue, meta, product_type).
- **Semaine 2** : texte SEO + FAQ sur toutes les collections principales (${realCols.slice(0, 4).join(", ") || "à détecter"}).
- **Semaine 3** : enrichir 15–20 fiches produits (en partant des scores de contenu les plus bas).
- **Semaine 4** : maillage interne complet + 2 guides blog (${kw.blog.slice(0, 2).join(" ; ")}) reliés aux collections.

## 9. ✂️ Corrections prêtes à copier
${readyToCopyBlock(ctx, cols, vocab)}

## 🚀 Actions Orkestra
- **SEO Studio** : fiches produits prioritaires + meta + FAQ collections.
- **Merchant Shield** : textes anglais + pages légales + structure catalogue.
- **Section Builder** : bloc FAQ de collection + réassurance.

> Données manquantes (texte SEO exact par collection, balises actuelles) : non disponibles via scan public — une connexion API Shopify les rendra exploitables.`;
}

function seoAnswerGeneric(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const cols = collectionsOf(ctx);
  const kws = keywordsOf(ctx);
  const niche = nicheOf(ctx);
  return `## Plan SEO pour ${s}

**Diagnostic express** — ${s} évolue sur la niche **${niche}**. Le potentiel SEO repose sur trois piliers : la structure des collections (${cols.slice(0, 3).join(", ")}…), la qualité des fiches produits et le maillage interne.

> 💡 Lancez un **scan public** de votre boutique pour une analyse chiffrée et des produits prioritaires concrets.

### Priorités SEO
1. **Pages collections** (${cols.slice(0, 4).join(", ")}) — title + 150–300 mots + FAQ.
2. **Fiches produits** — H1 orienté bénéfice (« ${kws[0] || "produit"} »), description 200+ mots, FAQ, avis.
3. **Meta** uniques (≤ 60 / ≤ 155 car.) avec CTA.
4. **Maillage interne** blog → ${cols.slice(0, 2).join(" / ")}.
5. **Alt text** avec mot-clé sur toutes les images.

> Demandez **« fais-moi le plan d'action sur 30 jours »** pour un planning détaillé.`;
}

function seoPlan30(ctx: CouncilContext): string {
  const cols = collectionsOf(ctx);
  return `## Plan d'action SEO — 30 jours pour ${brandOf(ctx)}

Plan structuré en 4 semaines, du plus fort impact au plus structurel.

### Semaine 1 — Fondations & quick wins
- [ ] Auditer les meta titles/descriptions manquantes ou dupliquées.
- [ ] Réécrire les meta des collections **${cols.slice(0, 2).join(", ")}** (≤ 60 / ≤ 155 car.).
- [ ] Corriger les alt text des images produits prioritaires.
- **Impact attendu :** visibilité rapide sur les pages déjà indexées.

### Semaine 2 — Collections
- [ ] Ajouter 150–300 mots de contenu SEO unique sur ${cols.slice(0, 4).join(", ")}.
- [ ] Structurer H1/H2 + bloc FAQ de collection.
- [ ] Mettre en place le maillage interne entre collections liées.
- **Impact attendu :** gain de positions sur les requêtes commerciales.

### Semaine 3 — Fiches produits
- [ ] Réécrire les 10 fiches les plus vues (200+ mots, bénéfices, FAQ).
- [ ] Ajouter avis/preuve sociale au-dessus de la ligne de flottaison.
- [ ] Optimiser les handles et les balises.
- **Impact attendu :** meilleure conversion + longue traîne produit.

### Semaine 4 — Contenu & autorité
- [ ] Publier 2 articles de blog longue traîne pointant vers les collections.
- [ ] Renforcer le maillage blog → collections → produits.
- [ ] Lancer **Merchant Shield** pour la conformité.
- **Impact attendu :** trafic incrémental et autorité thématique.

### 📊 Suivi
- KPIs : positions moyennes, clics Search Console, taux de conversion par page.
- Revue hebdomadaire le vendredi : ce qui bouge, ce qu'on ajuste.

> Je peux générer directement les fiches produits (SEO Studio) ou les meta — dites-moi par quoi commencer.`;
}

function sectionTypeFromQuestion(q: string): string {
  const t = q.toLowerCase();
  if (/faq|question/.test(t)) return "FAQ animée";
  if (/réassur|reassur|confiance|garantie|livraison/.test(t)) return "Bloc réassurance";
  if (/comparatif|comparaison|versus/.test(t)) return "Comparatif produit";
  if (/avis|témoignage|temoignage|review/.test(t)) return "Avis clients";
  if (/sticky|panier|add to cart/.test(t)) return "Sticky add-to-cart";
  if (/storytelling|histoire|à propos/.test(t)) return "Storytelling";
  if (/bénéfice|benefice|avantage/.test(t)) return "Section bénéfices";
  if (/image|texte/.test(t)) return "Image + texte";
  return "Hero premium";
}

function codeAnswer(ctx: CouncilContext, question: string): string {
  const s = brandOf(ctx);
  const niche = nicheOf(ctx);
  const explainOnly = /\b(explique|où (l['’])?installer|où installer|comment (ajouter|installer)|où dans shopify|précaution|precaution)\b/i.test(question) && !/\b(crée|cree|génère|genere|code|écris|ecris|fais)\b/i.test(question);
  const type = sectionTypeFromQuestion(question);

  if (explainOnly) {
    return `## 🧩 Installer une section dans Shopify

1. **Admin Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code.**
2. **Sections → Ajouter un fichier** → nommez-le \`ma-section.liquid\`.
3. Collez le **Liquid + le \`{% schema %}\`** (le CSS et le JS éventuels vont dans la balise \`<style>\`/\`<script>\` du même fichier — aucun asset externe).
4. Enregistrez, puis **Personnaliser** → ajoutez la section et réglez ses options.
5. **Avant publication** : aperçu mobile, contenu réel, contraste, liens des CTA.

> Dites-moi quel type de section vous voulez (FAQ, hero, réassurance, comparatif…) et je vous génère le code complet, adapté à ${s}.`;
  }

  // Génère une section premium adaptée à la niche/boutique.
  const sec = generateSection({
    type,
    goal: `Section ${type} pour ${s} (${niche})`,
    animations: true,
    niche: ctx.niche,
    brandName: ctx.brandName,
    collection: ctx.collections?.[0],
  });
  const jsBlock = sec.js && !/aucun js/i.test(sec.js) ? `\n**JS (encapsulé, non bloquant)**\n\`\`\`js\n${sec.js}\n\`\`\`` : "\n_Aucun JavaScript nécessaire (CSS/Liquid suffisent)._";
  const faqHint = niche.includes("lumi")
    ? " — pour des luminaires, pensez aux questions : hauteur d'installation, type d'ampoule, choix selon la pièce (salon, salle à manger, chambre, escalier), entretien, livraison/retours."
    : "";

  return `## 🧩 Section Shopify — ${type} pour ${s}

### 1. Résumé
- **Type** : ${type}
- **Objectif** : ${sectionPurpose(sectionKey(type))}${faqHint}
- **Page recommandée** : ${sectionPlacement(sectionKey(type), undefined)}
- **Pourquoi** : ${sectionWhy(sectionKey(type))}${ctx.collections?.length ? ` Aligné sur vos collections (${ctx.collections.slice(0, 3).join(", ")}).` : ""}

### 2. Code complet (Online Store 2.0)
**Liquid**
\`\`\`liquid
${sec.liquid}
\`\`\`
**CSS**
\`\`\`css
${sec.css}
\`\`\`
**Schema**
\`\`\`liquid
${sec.schema}
\`\`\`${jsBlock}

### 3. Installation
${sec.installSteps.map((x, i) => `${i + 1}. ${x}`).join("\n")}

### 4. Checklist qualité
${sec.responsiveChecklist.map((c) => `- ✅ ${c.label}`).join("\n")}
- ✅ Schema JSON valide · classes namespacées \`.ork-\` · aucune dépendance externe${sec.warnings && sec.warnings.length ? `\n- ⚠️ ${sec.warnings.join(" · ")}` : ""}

### 5. Pour aller plus loin (demandez simplement)
« Rends-la plus premium » · « Optimise le mobile » · « Ajoute plus de settings » · « Version sans JS » · « Corrige le code » · « Adapte à ma niche » · « Adapte pour ma page produit » · « Adapte pour la home » · « Fais une version plus luxe »

> ⚠️ **Mode démo** — ceci est un exemple de structure. Connectez OpenAI (ou Claude prochainement) pour générer/raffiner une version premium finale avant installation.`;
}

function merchantAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const found = ctx.legalFound ?? [];
  const missing = ctx.missingLegal ?? [];
  const score = ctx.merchantScore;

  const reassuring: string[] = [];
  for (const f of found) reassuring.push(`${f} détectée : OK`);
  if (!reassuring.length) reassuring.push("Aucune page de confiance détectée publiquement (à vérifier).");

  const critical: string[] = [];
  const important: string[] = [];
  const minor: string[] = [];
  for (const m of missing) {
    if (/retour|livraison|mentions/i.test(m)) critical.push(`**${m} non détectée** → cause fréquente de refus/suspension Merchant.`);
    else important.push(`**${m} non détectée** → à ajouter avant soumission.`);
  }
  if (ctx.englishCount) critical.push(`**${ctx.englishCount} textes anglais** sur une boutique ${ctx.language || "FR"} → incohérence de langue (signal négatif).`);
  if (ctx.weakDescriptions) important.push(`**${ctx.weakDescriptions} fiches** à description faible → risque « contenu insuffisant / misrepresentation ».`);
  if (ctx.noType) important.push(`**${ctx.noType} produits sans \`product_type\`** → catégorisation faible dans le flux Shopping.`);
  if (ctx.imagesNoAlt) minor.push(`**${ctx.imagesNoAlt} images sans alt** → impact SEO/accessibilité, priorité Merchant **secondaire** vs pages légales/descriptions.`);
  if (!found.includes("Garantie")) important.push("**Garantie** non détectée → à ajouter ou clarifier (rassure Google et l'acheteur).");
  if (!critical.length) critical.push("Aucun risque critique évident détecté sur la vue publique — vérifiez tout de même les pages légales en profondeur.");

  return `## 🛡️ Audit conformité Merchant Center — ${s}

> ⚠️ Aucun outil ne peut garantir l'absence de suspension. Orkestra **détecte les risques fréquents visibles publiquement** et aide à rendre la boutique plus propre **avant soumission** à Google Merchant Center / Shopping. Google reste seul décisionnaire.

### 📊 Résumé conformité apparent
${dataUsed(ctx).filter((d) => /produit|collection|anglais|légal|meta|images|couverture/i.test(d)).map((d) => `- ${d}`).join("\n") || "- Données de scan limitées."}
${score != null ? `\n**Score Merchant apparent : ${score}/100** (estimation vue publique).` : ""}

### ✅ Éléments rassurants déjà présents
${reassuring.map((r) => `- ${r}`).join("\n")}

### 🔴 Risques critiques (à corriger avant Shopping)
${critical.map((r) => `- ${r}`).join("\n")}

### 🟠 Risques importants
${important.length ? important.map((r) => `- ${r}`).join("\n") : "- Aucun risque important supplémentaire détecté."}

### 🟡 Risques mineurs
${minor.length ? minor.map((r) => `- ${r}`).join("\n") : "- Promotions trop agressives à éviter ; multiplier les moyens de contact."}

### ✅ Checklist avant soumission Merchant Center
- [ ] Politique de **retour** et de **livraison** claires, liées au footer.
- [ ] **Mentions légales**, **CGV**, **confidentialité**, **contact** présentes.
- [ ] **Garantie** et informations entreprise visibles.
- [ ] **Aucun texte anglais** résiduel (${ctx.englishCount ?? 0} détecté(s)).
- [ ] Descriptions produits solides (200+ mots) sur les best-sellers.
- [ ] \`product_type\` renseigné, prix cohérents fiche/panier/flux.

### 🗂️ Plan de correction priorisé
1. Pages légales manquantes${missing.length ? ` (${missing.join(", ")})` : ""}.
2. Traduction des libellés anglais.
3. Enrichissement des descriptions + product_type.
4. Alt text (priorité plus basse côté Merchant).

### 🚀 Modules Orkestra
- **Merchant Shield** : audit détaillé + correctifs générables.
- **SEO Studio** : descriptions produits solides + meta.
- **Section Builder** : bloc réassurance + pages de confiance.`;
}

type EmailCase = "retard" | "retour" | "dimensions" | "hesitant" | "b2b" | "reclamation" | "relance" | "devis" | "general";
function detectEmailCase(q: string): EmailCase {
  const t = q.toLowerCase();
  if (/retard|pas reçu|pas recu|où est|ou est|suivi/.test(t)) return "retard";
  if (/retour|rembours|rétract|retract|échange|echange/.test(t)) return "retour";
  if (/dimension|taille|mesure|hauteur|largeur/.test(t)) return "dimensions";
  if (/hésit|hesit|conseil|aider à choisir|lequel/.test(t)) return "hesitant";
  if (/b2b|professionnel|grossiste|revendeur|entreprise/.test(t)) return "b2b";
  if (/réclam|reclam|mécontent|mecontent|cassé|casse|défect|defect|plainte/.test(t)) return "reclamation";
  if (/relance|sans réponse|sans reponse|panier abandonné/.test(t)) return "relance";
  if (/devis|cotation|prix pour|tarif/.test(t)) return "devis";
  return "general";
}

function emailAnswer(ctx: CouncilContext, question: string): string {
  const s = brandOf(ctx);
  const vous = ctx.formality === "tutoiement" ? "tu" : "vous";
  const greet = vous === "tu" ? "Bonjour [Prénom]," : "Bonjour [Prénom],";
  const ship = ctx.shippingDelay || "[délai de livraison à confirmer]";
  const ret = ctx.returnPolicy || "[politique de retour à confirmer]";
  const c = detectEmailCase(question);

  const cases: Record<EmailCase, { analyse: string; objet: string; corps: string }> = {
    retard: { analyse: "Le client s'inquiète d'un retard de livraison → rassurer + donner une action concrète (suivi).", objet: `Votre commande ${s} — suivi et délai`, corps: `Merci pour votre message, et navré pour l'attente. Votre commande a bien été prise en compte ; le délai habituel est de ${ship}. Je vérifie immédiatement le suivi et reviens vers vous avec le statut exact. Si le colis devait dépasser le délai annoncé, nous trouverons une solution (renvoi ou geste commercial).` },
    retour: { analyse: "Demande de retour/remboursement → rappeler la politique et faciliter la démarche.", objet: `Votre retour ${s} — marche à suivre`, corps: `Bien sûr, c'est possible. Notre politique : ${ret}. Pour lancer le retour, indiquez-${vous === "tu" ? "moi" : "moi"} votre numéro de commande ; je ${vous === "tu" ? "t'" : "vous "}envoie les instructions et l'étiquette le cas échéant. Le remboursement est traité dès réception et contrôle de l'article.` },
    dimensions: { analyse: "Demande de dimensions/caractéristiques → donner les infos disponibles, ne pas inventer.", objet: `Dimensions & caractéristiques — ${s}`, corps: `Merci de votre intérêt. Pour ce produit, voici les informations [à compléter depuis la fiche : dimensions, matériau, ${ctx.niche?.includes("lumi") ? "hauteur d'installation, type d'ampoule" : "usage"}]. Si vous me précisez le modèle exact, je vous confirme les mesures et vous conseille selon votre besoin.` },
    hesitant: { analyse: "Client hésitant → rassurer, conseiller, lever l'objection.", objet: `Je vous aide à choisir — ${s}`, corps: `Avec plaisir ! Pour bien vous conseiller : quel est votre besoin (pièce, style, budget) ? En général, ${vous === "tu" ? "tu peux" : "vous pouvez"} compter sur ${ctx.promises?.slice(0, 2).join(", ") || "notre sélection premium"}. Et si le produit ne convient pas, ${ret}.` },
    b2b: { analyse: "Demande B2B/pro → ouvrir le dialogue, proposer conditions volume.", objet: `Demande professionnelle — ${s}`, corps: `Merci pour votre intérêt. Nous accompagnons les professionnels (revendeurs, projets). Pour vous faire une proposition adaptée : quels produits/quantités visez-vous, et pour quelle échéance ? Je reviens vers vous avec des conditions (tarifs volume, délais, livraison).` },
    reclamation: { analyse: "Réclamation → empathie d'abord, puis solution rapide.", objet: `Votre réclamation — nous prenons en charge (${s})`, corps: `Je suis sincèrement navré pour ce désagrément, ce n'est pas le niveau de qualité que nous visons. Pouvez-${vous === "tu" ? "tu m'" : "vous m'"}envoyer une photo et votre numéro de commande ? Je vous propose immédiatement [remplacement / remboursement] et fais le nécessaire en priorité.` },
    relance: { analyse: "Relance/panier abandonné → rappel doux + incitation.", objet: `Votre sélection ${s} vous attend`, corps: `Je reviens vers ${vous === "tu" ? "toi" : "vous"} : votre sélection est toujours disponible. Si une question vous a retenu (livraison, dimensions, choix), je suis là pour ${vous === "tu" ? "t'" : "vous "}aider. Pour rappel : ${ctx.promises?.slice(0, 2).join(", ") || "livraison soignée et retours simples"}.` },
    devis: { analyse: "Demande de prix/devis par email → cadrer le besoin avant chiffrage.", objet: `Votre demande de devis — ${s}`, corps: `Merci pour votre demande. Pour établir un devis précis : quels produits/quantités, et pour quelle date de livraison souhaitée ? Dès réception, je vous envoie un devis détaillé (prix, délais, conditions).` },
    general: { analyse: "Demande générale → réponse pro, claire, orientée solution.", objet: `Votre message — ${s}`, corps: `Merci pour votre message. [Reformulation de la demande.] Voici ce que je vous propose : [solution concrète], sous [délai]. ${ret}. Je reste à votre disposition pour toute question.` },
  };
  const e = cases[c];

  return `## ✉️ Email client — ${s}

**Analyse rapide** : ${e.analyse}

### Email prêt à envoyer
**Objet :** ${e.objet}

---
${greet}

${e.corps}

${vous === "tu" ? "À très vite," : "Bien à vous,"}
[Votre prénom] — Service client ${s}
---

### Variante courte
> ${greet} ${e.corps.split(".")[0]}. Je m'en occupe et reviens vers ${vous === "tu" ? "toi" : "vous"} rapidement. ${vous === "tu" ? "À bientôt" : "Bien à vous"}, ${s}.

### Variante plus chaleureuse
> Ajoutez une touche personnelle (remerciement sincère, petit geste) et un emoji léger si votre marque le permet.

> ⚠️ Les informations entre [crochets] ne sont pas confirmées par le scan public — **à vérifier dans votre back-office** avant envoi (ton : ${ctx.formality || "vouvoiement"}${ctx.shippingDelay ? `, livraison ${ctx.shippingDelay}` : ""}).`;
}

function quoteAnswer(ctx: CouncilContext, question: string): string {
  const s = brandOf(ctx);
  const ship = ctx.shippingDelay || "[délai à confirmer]";
  return `## 🧾 Assistant devis — ${s}

**Résumé du besoin** : ${question ? `« ${question.trim().slice(0, 120)} »` : "devis commercial (à préciser)"}.

### À demander si l'info manque
- Produits/références exactes + **quantités**.
- **Date de livraison** souhaitée + adresse (national/international).
- Cadre : particulier, **B2B / revendeur**, projet **sur-mesure**, **lot**, livraison spéciale.
- Budget indicatif (utile pour proposer une gamme).

### Structure de devis recommandée
**Émis par :** ${s} · **Pour :** [Client] · **Date :** [date] · **Validité :** 30 jours

| Réf. | Désignation | Qté | PU HT | Remise | Total HT |
|---|---|---|---|---|---|
| [réf.1] | [produit] | [qté] | [€] | [%] | [€] |
| [réf.2] | [produit] | [qté] | [€] | [%] | [€] |

**Récapitulatif** : Total HT [€] · TVA 20% [€] · **Total TTC [€]**

### Conditions
- **Acompte** 30% à la commande, solde avant expédition (ajustable B2B).
- **Délai** : ${ship} après validation (préciser si sur-mesure).
- **Remise volume** : proposer un palier (ex. -5% dès [X] unités, -10% dès [Y]).
- Frais de livraison : [selon poids/destination].

### Message d'accompagnement (email)
> Bonjour [Prénom], suite à votre demande, voici votre devis en pièce jointe. Il est valable 30 jours et inclut [points clés]. Je reste disponible pour l'ajuster (quantités, délais, livraison). Bien à vous, ${s}.

### ✅ À vérifier avant envoi
- Prix et remises cohérents avec vos marges.
- TVA et mentions légales (n° devis, SIRET).
- Délais réalistes selon stock/sur-mesure.

> Données produits/prix exactes : **non disponibles via scan public** — à renseigner depuis votre catalogue (l'API Shopify les rendra automatiques).`;
}

function strategyAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const cols = ctx.collections?.length ? ctx.collections : [];
  return `## 📈 Diagnostic & stratégie e-commerce — ${s}

### Diagnostic business rapide
${dataUsed(ctx).slice(0, 6).map((d) => `- ${d}`).join("\n") || "- Lancez un scan pour un diagnostic chiffré."}
- Niche : **${nicheOf(ctx)}**, positionnement **${ctx.positioning || "premium"}**.

### Priorités par impact
- **Haut** : ${ctx.weakDescriptions ? `enrichir ${ctx.weakDescriptions} fiches faibles + ` : ""}optimiser le SEO des collections (${cols.slice(0, 3).join(", ") || "principales"}) — ROI durable.
- **Moyen** : réassurance + preuve sociale pour la conversion ; ${ctx.englishCount ? `traduire ${ctx.englishCount} libellés ; ` : ""}corriger les pages légales.
- **Bas** : alt text, tags, structure catalogue.

### Opportunités de croissance
- **SEO** : ${ctx.productsFound ?? "de nombreux"} produits → fort potentiel longue traîne (clusters par collection).
- **Conversion** : fiches premium + FAQ + avis = +taux de transformation sans coût d'acquisition.
- **Contenu** : guides d'achat (« comment choisir… ») reliés aux collections.
- **Ads/Merchant** : flux Shopping propre (product_type, descriptions) sur les best-sellers à marge.

### Roadmap
**7 jours** — quick wins : meta manquantes (${ctx.missingMeta ?? 0}), textes anglais (${ctx.englishCount ?? 0}), product_type (${ctx.noType ?? 0}), réassurance home.
**30 jours** — contenu SEO collections + 15–20 fiches enrichies + maillage interne + scénarios email (bienvenue, panier, post-achat).
**90 jours** — clusters blog, programme fidélité, montée en puissance Google Shopping, optimisation continue (A/B fiches & home).

### ⚡ Quick wins
- Bloc réassurance haut de home (Section Builder).
- FAQ collections (rich snippets).
- Avis clients visibles au-dessus de la ligne de flottaison.

### ⚠️ Risques
- Conformité Merchant (pages légales/langue) avant d'investir en Ads.
- Contenu dupliqué/fournisseur sur les fiches → pénalisant SEO.

### 🚀 Modules Orkestra
- **SEO Studio** (contenu), **Merchant Shield** (conformité avant Ads), **Section Builder** (conversion).

> Demandez **« plan d'action sur 30 jours »** pour le détail hebdomadaire.`;
}

function strategyPlan30(ctx: CouncilContext): string {
  return `## Plan stratégique — 30 jours pour ${brandOf(ctx)}

### Semaine 1 — Conversion (ROI immédiat)
- [ ] Auditer le tunnel et lever les frictions du checkout.
- [ ] Ajouter réassurance + avis sur les fiches clés.

### Semaine 2 — Contenu & SEO
- [ ] Optimiser collections + 10 fiches best-sellers.
- [ ] Lancer le maillage interne.

### Semaine 3 — Acquisition
- [ ] Configurer Google Shopping sur les produits à marge.
- [ ] Tester 2 angles publicitaires.

### Semaine 4 — Rétention
- [ ] Mettre en place les scénarios email (bienvenue, panier, post-achat).
- [ ] Définir une offre de fidélité.

### 📊 KPIs
Taux de conversion, panier moyen, CAC, LTV, ROAS.`;
}

function competitorBlock(name: string, ctx: CouncilContext, vocab: NicheVocab): string {
  const niche = nicheOf(ctx);
  const cats = (ctx.collections?.length ? ctx.collections : (ctx.productTypes ?? [])).slice(0, 4).join(", ") || niche;
  return `**${name}**
- *Type* : boutique e-commerce spécialisée ${niche}.
- *Positionnement probable* : proche du vôtre (${ctx.positioning || "premium"}), spécialiste de la catégorie.
- *Catégories fortes* : ${cats}.
- *Angle SEO probable* : pages collections optimisées + guides d'achat (${vocab.descHints.split(",").slice(0, 2).join(",")}) — à analyser.
- *Forces UX/conversion à surveiller* : fiches riches, réassurance, avis clients (à vérifier avec une URL).
- *Opportunité pour vous* : créer des collections plus riches + un meilleur maillage interne par ${vocab.pieces[0] ? "pièce (" + vocab.pieces.slice(0, 3).join(", ") + ")" : "usage"}.
- *Orkestra recommande* : les dépasser sur la profondeur de contenu (FAQ, guides) et la spécificité longue traîne.`;
}

function competitiveAnswer(ctx: CouncilContext): string {
  const s = brandOf(ctx);
  const niche = nicheOf(ctx);
  const key = detectNiche(`${ctx.niche ?? ""} ${ctx.brandName ?? ""}`);
  const { preset } = getPreset(ctx);
  const vocab = nicheVocab(key);

  // Concurrents DIRECTS spécialisés (saisis par l'utilisateur, sinon preset),
  // en excluant les généralistes.
  const generalists = preset.generalists ?? [];
  const userDirect = (ctx.competitors ?? []).filter((c) => !generalists.some((g) => g.toLowerCase() === c.toLowerCase()));
  const direct = (userDirect.length ? userDirect : preset.competitors).slice(0, 5);
  const fromUser = userDirect.length > 0;
  const conf = fromUser ? "confiance élevée (fourni)" : "confiance : à confirmer (basée sur la niche)";
  const cols = ctx.collections ?? [];

  return `## ⚔️ Analyse concurrentielle — ${s} (niche ${niche})

> ℹ️ **Analyse indicative basée sur la niche, les produits et le positionnement détectés** (pas de recherche web ni de crawl concurrent). Les noms ci-dessous sont des **concurrents directs probables** ; aucun chiffre (trafic, CA, conversion, parts de marché) n'est affirmé. **Ajoutez les URLs de vos concurrents** pour une analyse plus précise.

## 1. Concurrents directs probables (spécialisés)
${direct.map((c) => `- **${c}** — e-commerce spécialisé ${niche} · proche de ${s} (niche, ${ctx.positioning || "premium"}, ${ctx.country || "FR"}) · ${conf}.`).join("\n")}

## 2. Pourquoi ce sont vos concurrents
- **Même niche** : ${niche}${cols.length ? ` (catégories : ${cols.slice(0, 4).join(", ")})` : ""}.
- **Positionnement proche** : ${ctx.positioning || "premium"}, ${ctx.language || "FR"}.
- **Même audience & intention d'achat** : ils ciblent les mêmes requêtes que vous (pas une marketplace généraliste).

## 3. Analyse rapide par concurrent
${direct.slice(0, 4).map((c) => competitorBlock(c, ctx, vocab)).join("\n\n")}

## 4. Opportunités pour ${s}
- **Collections à renforcer** : ${cols.slice(0, 4).join(", ") || "vos collections principales"} (texte SEO + FAQ).
- **Pages SEO à créer** : guides d'achat (${vocab.faqs(cols[0] || "produits")[0]}).
- **Maillage interne** : par ${vocab.pieces[0] ? "pièce (" + vocab.pieces.slice(0, 3).join(", ") + ")" : "thématique"}, collection ↔ collection.
- **Différenciation marque** : ${ctx.promises?.slice(0, 2).join(", ") || "service & conseil d'expert"}.
- **Réassurance & UX** : avis clients, livraison/retours visibles, sections comparatives.
- **Stratégie contenu** : longue traîne (${nicheKeywords(key, vocab, cols).longtail.slice(0, 3).map((k) => `« ${k} »`).join(", ")}).

## 5. Acteurs généralistes à surveiller (secondaire)
${generalists.length ? generalists.map((g) => `- ${g}`).join("\n") : "- (aucun identifié)"}
> ⚠️ **Pas vos concurrents directs principaux** : difficiles à battre frontalement, mais à surveiller (prix, délais). Votre avantage = la **spécialisation** et la profondeur de contenu.

## 6. Prochaine étape
**Ajoutez les URLs de 3 concurrents** dans la Mémoire boutique pour une analyse comparative plus précise (à confirmer avec leurs vraies pages).`;
}

function freeAnswer(q: string, ctx: CouncilContext): string {
  // Routing intelligent : on bascule vers l'expert correspondant à l'intention.
  const intent = detectIntent(q || "");
  if (intent !== "free") {
    return `> **Mode : Question libre** · intention détectée → **${MODE_LABEL[intent]}**. Pour une réponse encore plus ciblée, sélectionnez ce mode en haut.\n\n` + buildFinalAnswer(intent, q, ctx);
  }
  // Demande d'aide Shopify "comment faire" → mini guide pas à pas.
  if (/comment|où|ou |pourquoi|aide/i.test(q)) {
    return `> **Mode : Question libre** · Données : mémoire boutique\n\n## Réponse Orkestra — ${brandOf(ctx)}

Concernant « ${q.trim().slice(0, 120)} » :
1. **Diagnostic** : ce que ça implique pour votre boutique (${nicheOf(ctx)}).
2. **Étapes concrètes** : 3 à 5 actions ordonnées.
3. **Module Orkestra** recommandé selon le sujet (SEO Studio / Merchant Shield / Section Builder / Assistant Shopify).
4. **Mesure** : comment vérifier le résultat.

> Précisez un mode (SEO, Merchant Center, Code Shopify…) pour une réponse d'expert dédiée.`;
  }
  return `> **Mode : Question libre** · Données : mémoire boutique\n\n## Réponse Orkestra — ${brandOf(ctx)}

${q ? `Concernant « ${q.trim().slice(0, 120)} » :` : "Voici une réponse structurée :"}
- **Contexte** : ${nicheOf(ctx)}, positionnement ${ctx.positioning || "premium"}${ctx.productsFound ? `, ${ctx.productsFound} produits détectés` : ""}.
- **Recommandation principale** : l'action à plus fort impact à lancer en premier.
- **Étapes** : 3 à 5 actions concrètes.
- **Module Orkestra** recommandé + **mesure** du résultat.

> Sélectionnez un mode en haut (SEO, Merchant, Code…) pour une réponse d'expert spécialisée.`;
}

// ── Review / analyse complète de site (adaptée à la boutique) ────────────────

export function buildSiteReview(ctx: CouncilContext): { markdown: string; review: SiteReview } {
  const s = brandOf(ctx);
  const niche = nicheOf(ctx);
  const cols = collectionsOf(ctx);
  const kws = keywordsOf(ctx);

  // Ordres & problèmes ADAPTÉS À LA NICHE de la boutique active.
  const { preset } = getPreset(ctx);
  const homepageOrder = preset.homepageOrder;
  const productPageStructure = preset.productPageStructure;
  const issues = buildReviewIssues(ctx);

  const markdown = `## Review complète de ${s}

${scanContextLine(ctx)}Analyse adaptée à votre niche **${niche}**. Voici l'état des lieux, page par page, puis les recommandations priorisées.

### 🔍 SEO global
- Intention bien identifiable (${kws.slice(0, 3).map((k) => `« ${k} »`).join(", ")}) mais sous-exploitée.
- Collections et fiches produits insuffisamment optimisées (texte, Hn, meta).

### 🏠 Page d'accueil
- Hero présent mais promesse à clarifier (bénéfice + ambiance).
- Réassurance et preuve sociale trop basses → à remonter.
- **Ordre recommandé :** ${homepageOrder.join(" → ")}.

### 📁 Pages collections
- ${cols.slice(0, 4).join(", ")} : peu ou pas de texte SEO unique, pas de FAQ.
- Un seul H1 par page, des H2 par sous-thème à ajouter.

### 🛍️ Pages produits
- Descriptions courtes, bénéfices peu visibles, pas de FAQ produit ni d'avis bien placés.
- **Structure idéale :** ${productPageStructure.join(" → ")}.

### ✍️ Contenu & rédaction
- Qualité des descriptions : à renforcer (200+ mots, orienté bénéfices et ambiance).
- Contenu potentiellement dupliqué entre fiches similaires → différencier.

### 🏷️ Meta & balises
- Meta titles/descriptions manquantes ou dupliquées ; H1/H2/H3 à structurer.
- Alt text d'images souvent absents (ajouter le mot-clé, ex. « ${kws[0]} »).

### 🌐 Traduction & cohérence
- ${ctx.englishCount != null ? `${ctx.englishCount} texte(s) anglais détecté(s) par le scan public` : "Textes anglais résiduels du thème détectés (libellés panier)"}.
- Vérifier les erreurs de traduction et la cohérence de marque.

### 🛡️ Conformité & confiance (Merchant Center)
- ${ctx.missingLegal?.length ? `Pages manquantes détectées : ${ctx.missingLegal.join(", ")}.` : "Politique de retour/livraison et mentions légales à compléter et rendre visibles."}
- Page contact à enrichir (plusieurs moyens + délai de réponse).
- Risque **misrepresentation** à surveiller (promotions, cohérence prix).

### 🧭 UX & conversion
- Réassurance (livraison gratuite, paiement sécurisé, garanties) à afficher plus tôt.
- Éléments manquants pour rassurer : avis visibles, garanties, FAQ.

> 👉 Ci-dessous, chaque problème détecté est listé avec sa **gravité**, son **impact**, la **correction recommandée** et un bouton **Corriger avec Orkestra**.`;

  return {
    markdown,
    review: { summary: markdown, homepageOrder, productPageStructure, issues },
  };
}

// ── Réponses individuelles par IA (onglets) ─────────────────────────────────

function buildProviderAnswer(p: AIProviderId, ctx: CouncilContext, baseMarkdown: string): string {
  const profile = PROVIDER_PROFILE[p];
  const s = brandOf(ctx);
  const angle: Record<AIProviderId, string> = {
    openai: `Voici ma version la plus **opérationnelle** : j'ai priorisé une feuille de route claire et ordonnée pour ${s}, avec des actions immédiatement exécutables.`,
    anthropic: `J'ai privilégié une réponse **rédigée et nuancée**, alignée sur le ton premium de ${s}, en expliquant le *pourquoi* derrière chaque recommandation.`,
    gemini: `J'ai adopté un angle **analytique** : cohérence, conformité et données pour ${s} avant de recommander.`,
    openrouter: `Variante **rapide et alternative** : une lecture complémentaire utile pour ${s}, à comparer avec les autres modèles.`,
    mistral: `Réponse **concise et efficace** en français pour ${s}, droit aux actions essentielles.`,
  };
  return `${angle[p]}\n\n${condense(baseMarkdown)}\n\n*Spécialité : ${profile.specialty}.*`;
}

/** Condense une réponse markdown en gardant titres et premières puces. */
function condense(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let bulletsAfterHeading = 0;
  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
      out.push(line.replace(/^###?\s/, "### "));
      bulletsAfterHeading = 0;
    } else if (/^\s*[-*\d.]/.test(line) && bulletsAfterHeading < 2) {
      out.push(line);
      bulletsAfterHeading++;
    }
    if (out.length > 16) break;
  }
  return out.join("\n");
}

// ── Directives des boutons d'action ─────────────────────────────────────────

function applyDirective(answer: string, directive?: CouncilContext["directive"]): string {
  switch (directive) {
    case "shorten":
      return "## Version courte (TL;DR)\n\n" + condense(answer);
    case "premium":
      return answer + "\n\n---\n\n> ✨ **Touche premium** : soignez la cohérence visuelle, le storytelling de marque et la réassurance haut de gamme à chaque étape.";
    case "improve":
      return answer + "\n\n---\n\n> 🔁 **Version améliorée** : recommandations enrichies de bonnes pratiques e-commerce supplémentaires et d'un ordre de priorité affiné.";
    case "html":
      return "## Export HTML\n\n```html\n" + markdownToHtml(answer) + "\n```";
    default:
      return answer;
  }
}

/** Conversion markdown → HTML simple (pour le bouton « Convertir en HTML »). */
function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((l) => {
      if (/^##\s/.test(l)) return `<h2>${l.replace(/^##\s/, "")}</h2>`;
      if (/^###\s/.test(l)) return `<h3>${l.replace(/^###\s/, "")}</h3>`;
      if (/^\s*-\s/.test(l)) return `<li>${l.replace(/^\s*-\s/, "")}</li>`;
      if (l.trim() === "") return "";
      return `<p>${l}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}
