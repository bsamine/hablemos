# ¡Hablemos!

A voice-first Spanish speaking coach. The learner talks with **Lucía**, an AI tutor, for 15 minutes a day on a themed task. Corrections happen during the conversation. After each session she gets a feedback card in French, and her new words come back later on a spaced-repetition schedule.

- **Live voice:** Gemini Live API, connected directly from the browser with a one-use ephemeral token. The API key never leaves the server.
- **Debrief:** a Gemini text model turns the transcript into JSON: errors, better phrasings, word tracking and level signals.
- **App:** Next.js 16 with a French UI and passcode login, installable on iPhone as a home-screen app.
- **Data:** SQLite in `./data` (sessions, transcripts, words, errors).
- **Hosting:** Docker Compose, with Caddy providing automatic HTTPS. The microphone only works over HTTPS.

```
src/lib/scenarios.ts   14 daily-life sessions (task, persona, 5 target words)
src/lib/prompts.ts     tutor prompt + debrief prompt
src/lib/learning.ts    spaced repetition, error tracking, stats
src/lib/audio.ts       mic → 16 kHz PCM, 24 kHz playback, es-ES speech for corrections
src/app/session/…      the live conversation screen
src/app/feedback/…     the feedback card
prompts/               Phase 0 prompt (paste into the Gemini app) + debrief prompt
```

## 1. Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key.
2. To start, the free tier is enough.
   - On the free tier, Google may use the data to improve its products.
   - Enable billing on the key's Google Cloud project when you want the paid tier. Paid-tier data isn't used that way, and rate limits are higher.
3. In AI Studio, check that the model IDs in `.env` exist (`GEMINI_LIVE_MODEL`, `GEMINI_TEXT_MODEL`). Google renames Live models often.
4. Set a budget alert on the Cloud project (e.g. €15/month).

## 2. Deploy on the Contabo server

SSH into the server (`ssh root@62.171.172.248`), then:

```bash
# Docker is already there if n8n runs in Docker; otherwise: curl -fsSL https://get.docker.com | sh
git clone https://github.com/bsamine/hablemos.git /opt/hablemos
cd /opt/hablemos
cp .env.example .env
nano .env            # fill GEMINI_API_KEY, APP_PASSCODE, SESSION_SECRET (openssl rand -hex 32)
mkdir -p data && chown 1000:1000 data
```

Check who uses ports 80/443:

```bash
ss -tlnp | grep -E ':(80|443)\s'
```

### Option A — ports 80/443 are free (n8n is on its own port, e.g. 5678)

```bash
docker compose up -d --build
docker compose logs -f app
```

Open **https://hablemos.62-171-172-248.sslip.io**. Caddy fetches the HTTPS certificate on the first request, which can take 30 s.

### Option B — another proxy already owns 80/443 (Traefik, Nginx, Caddy for n8n)

1. Delete the `caddy` service from `docker-compose.yml`.
2. Publish the app on localhost only: under `app`, replace `expose:` with `ports: ["127.0.0.1:3000:3000"]`.
3. Add a site for `hablemos.62-171-172-248.sslip.io` → `http://127.0.0.1:3000` in the existing proxy.

### Firewall

Allow 80 and 443 (`ufw allow 80,443/tcp` if ufw is active). Port 80 is needed for Let's Encrypt.

### Updates

```bash
cd /opt/hablemos && git pull && docker compose up -d --build
```

### Backups

Everything is in `/opt/hablemos/data/hablemos.db`. Copy that file, or take a Contabo snapshot.

## 3. Install on her iPhone

1. Open the URL in **Safari**, type the passcode, and allow the microphone when asked.
2. Tap Share → **Add to Home Screen**. It opens full-screen like an app.
3. If the mic is blocked, go to Settings → Apps → Safari → Microphone, or tap the "aA" icon in the address bar → Website Settings.
4. Earphones help: Lucía hears her better and doesn't hear herself.

## 4. Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000 (the mic works on localhost)
```

## Tuning

- **Her level:** `LEARNER_LEVEL` in `.env` (A1 → A2 → B1). Restart after changing it: `docker compose up -d`.
- **Voice:** `GEMINI_VOICE`. Try `Aoede`, `Kore`, `Leda` or `Zephyr`.
- **Session length:** `SESSION_MINUTES`.
- **Themes and words:** `src/lib/scenarios.ts`.
- **Correction style:** `src/lib/prompts.ts`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Impossible de contacter Gemini" | Wrong or missing `GEMINI_API_KEY`, or the model ID no longer exists → `docker compose logs app` |
| Connects then closes at once | Model ID in `GEMINI_LIVE_MODEL` is wrong; or set `GEMINI_LIVE_API_VERSION=v1beta` |
| No sound on iPhone | Silent switch on; tap Commencer again (audio must start from a tap) |
| Certificate error | Port 80 blocked, or DNS: `nslookup hablemos.62-171-172-248.sslip.io` must return the server IP |
