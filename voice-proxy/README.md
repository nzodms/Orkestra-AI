# Orkestra Voice — Proxy WebSocket Gemini Live

Repli temps réel quand les **tokens éphémères Gemini sont refusés** (`token: no-access`).
Le navigateur ouvre une WebSocket vers ce proxy ; le proxy ouvre la session Gemini
Live avec la vraie clé **côté serveur**. La clé Gemini ne transite jamais par le
navigateur et n'est jamais loggée.

```
Navigateur (Orkestra Voice)
   └─ wss://<proxy>/voice ──► Proxy Node (ce dossier)
                                  └─ wss://generativelanguage.googleapis.com/... ?key=<clé serveur>
```

## ⚠️ Pourquoi un serveur séparé (et pas Vercel)

**Vercel ne peut pas héberger ce proxy.** Ni les Serverless Functions (modèle
requête/réponse, pas d'« upgrade » WebSocket serveur), ni les Edge Functions
(pas de `WebSocketPair` comme Cloudflare) ne supportent une WebSocket serveur
persistante. Il faut un hébergeur qui garde une connexion ouverte :

- **Railway**, **Render**, **Fly.io** (recommandés, simples) ;
- ou n'importe quel petit serveur Node (VPS, Docker).

Tant qu'aucun proxy n'est déployé, Orkestra reste en **mode texte intelligent**.

## Déploiement express

### Railway (recommandé)
1. **New Project → Deploy from GitHub repo** → choisissez ce repo.
2. **Settings → Root Directory = `voice-proxy`** (important : le proxy est dans un
   sous-dossier). Railway lit alors `railway.json` (build Nixpacks, start
   `node server.mjs`, healthcheck `/health`).
3. **Variables** → pour un premier test avec une clé unique :
   `GEMINI_API_KEY = <ta clé Gemini>`. Optionnel/prod :
   `ALLOWED_ORIGINS = https://<ton-app>.vercel.app`. `PORT` est injecté
   automatiquement par Railway.
4. **Deploy**, puis copiez le domaine public (`xxxxx.up.railway.app`).
5. URL à mettre côté Next : `wss://xxxxx.up.railway.app/voice`.

### Render
1. Nouveau **Web Service** → repo → **Root Directory = `voice-proxy`**.
2. Build : `npm install` · Start : `npm start` (ou le `Dockerfile`).
3. Variable : `GEMINI_API_KEY` (+ `ALLOWED_ORIGINS` en prod).
4. URL publique → en `wss://…/voice`.

### Fly.io
```bash
cd voice-proxy
fly launch --dockerfile Dockerfile   # garde le port 8787
fly secrets set GEMINI_API_KEY=...    # ou la paire BYOK ci-dessous
```

### Docker (générique)
```bash
cd voice-proxy
docker build -t orkestra-voice-proxy .
docker run -p 8787:8787 -e GEMINI_API_KEY=... orkestra-voice-proxy
```

## Brancher l'app Next (Vercel)

Sur Vercel, définissez :

```
NEXT_PUBLIC_VOICE_PROXY_URL = wss://<votre-proxy>/voice
```

Au prochain build, si le token éphémère est refusé, Orkestra Voice bascule
automatiquement sur le proxy (badge **« Gemini Live · Proxy sécurisé »**).

## Clé Gemini — deux options

| Option | Quand | Variables (proxy) | Variables (Vercel) |
|--------|-------|-------------------|--------------------|
| **A — BYOK** (clé par utilisateur) | clés saisies dans `/connect` | `ORKESTRA_RESOLVE_URL`, `VOICE_PROXY_SECRET` | `VOICE_PROXY_SECRET` (même valeur) |
| **B — clé unique** | une seule clé Gemini partagée | `GEMINI_API_KEY` | — |

- **Option A** : le proxy appelle `https://<app>/api/voice/gemini-live/resolve-key`
  (serveur-à-serveur, en-tête secret partagé) pour obtenir la clé déchiffrée de
  l'utilisateur. Le secret n'est jamais exposé au navigateur.
- **Option B** : repli simple si aucune URL/secret n'est configuré.

## Variables d'environnement

Voir [`.env.example`](./.env.example). Essentielles : `PORT`,
`ALLOWED_ORIGINS` (à restreindre en prod), et **une** option de clé (A ou B).

## Sécurité

- La clé Gemini reste côté serveur ; jamais envoyée au navigateur, jamais loggée.
- `ALLOWED_ORIGINS` restreint les domaines navigateur autorisés à se connecter.
- `VOICE_PROXY_SECRET` protège l'endpoint de résolution BYOK (serveur-à-serveur).

## Diagnostic (logs `[VoiceProxy]`)

`gemini-live-proxy-start` · `…-connected-client` · `…-connected-google` ·
`…-audio-client-to-google` · `…-audio-google-to-client` · `…-tool-call` ·
`…-tool-result` · `…-close` · `…-error`.
