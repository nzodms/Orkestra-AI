# Orkestra Clipper (extension locale, test)

Sélection visuelle d'une zone produit sur n'importe quelle page → **capture pixel réelle**
→ envoi vers **Orkestra Lens**. Type « Alibaba Lens ».

> Le **bookmarklet** (dans Orkestra Lens → « Clipper Orkestra ») fait la même sélection
> mais envoie l'**image présente dans la zone** (limite navigateur : pas de capture pixel).
> Cette extension fait, en plus, une **vraie capture recadrée** de la zone sélectionnée.

## Installer en local (mode développeur, sans Chrome Web Store)

1. Ouvrez `chrome://extensions` (ou `edge://extensions`).
2. Activez **Mode développeur** (en haut à droite).
3. **Charger l'extension non empaquetée** → sélectionnez le dossier
   `extension/orkestra-clipper`.
4. Épinglez l'icône **Orkestra Clipper**.

## Configurer l'URL d'Orkestra

Dans `content.js`, éditez la 1ʳᵉ constante :

```js
var ORKESTRA_BASE = "http://localhost:3000"; // ou https://votre-app.vercel.app
```

Rechargez l'extension après modification.

## Utilisation

1. Allez sur une page produit (Alibaba, AliExpress, un concurrent, Shopify…).
2. Cliquez l'icône **Orkestra Clipper**.
3. La page passe en mode sélection (overlay sombre + « Sélectionnez le produit »).
4. Tracez un rectangle autour du produit (ou cliquez dessus).
5. **Analyser cette zone** → l'extension capture et recadre la zone, ouvre Orkestra
   Lens et lance l'analyse multi-IA (Gemini → OpenAI → recherche assistée).

## Comment ça marche

- `background.js` : capture l'onglet visible (`captureVisibleTab`) et ouvre Lens.
- `content.js` : overlay de sélection + recadrage canvas de la zone → `chrome.storage.local`.
- `bridge.js` : sur la page `/lens`, relit le crop et le transmet à la page via
  `window.postMessage({ source: "orkestra-clipper", imageData })`.

## Limites

- Pages restreintes non injectables : `chrome://`, Chrome Web Store, PDF natifs.
- La capture concerne la zone **visible** (pas le hors-écran).
- Pour publier un jour sur le Chrome Web Store : Phase ultérieure (non requis ici).
