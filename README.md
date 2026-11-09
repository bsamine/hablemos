# ¡Hablemos! — con Carla

A voice-first Spanish speaking coach. The learner talks with **Carla**, an AI tutor, for 15 minutes a day on a themed task. Corrections happen during the conversation. After each session she gets a feedback card in French, and her new words come back later on a spaced-repetition schedule.

- **Live voice:** Gemini Live API, connected directly from the browser with a one-use ephemeral token. The API key never leaves the server.
- **Debrief:** a Gemini text model turns the transcript into JSON: errors, better phrasings, word tracking and level signals.
- **App:** Next.js 16 with a French UI and passcode login, installable on iPhone as a home-screen app.
- **Data:** SQLite in `./data` (sessions, transcripts, words, errors).
- **Hosting:** Docker Compose, with Caddy providing automatic HTTPS. The microphone only works over HTTPS.

What the learner gets:

| Feature | Where |
| --- | --- |
| Daily themed session with Carla (30 topics, A1 → B1) | Home → Séance du jour |
| Carla remembers her: profile, facts from past sessions, last-session notes | /profil |
| Spoken drill of her corrections after each feedback card | Bilan → « Redire mes corrections » |
| Révision express: 4-minute voice quiz on the words due today | Home |
| Mon thème: role-play on a situation she describes | Home |
| Progress: minutes/week, words, errors trend, level estimates | /progres |
| Level suggestion when recent sessions show the next level | Home banner |
| History of all feedback cards with the full conversation | /historique |

```
src/lib/scenarios.ts   30 sessions (task, persona, 5 target words)
src/lib/modes.ts       session plans: scenario, redo, review, custom topic
src/lib/prompts.ts     Carla's prompt (memory, level rules) + debrief prompt
src/lib/profile.ts     name, about, level, remembered facts, level suggestion
src/lib/debrief.ts     background feedback generation
src/lib/learning.ts    spaced repetition, error tracking, stats
src/lib/progress.ts    progress page data
src/app/Conversation.tsx  the live voice screen (all modes)
src/app/api/n8n/summary   JSON for automations (reminders, weekly summary, alerts)
scripts/backup.sh      daily DB backup (cron installed by deploy.sh)
```

## Changelog

### v0.1.1 — « Vivir en español »
- **Faster, more patient Carla.** The session is prepared while you read the intro, so "Commencer" only has to connect. Turn-taking is tuned for learners: Carla waits longer before answering at A1/A2, so she doesn't cut you off while you look for a word. You can choose her voice on the Profile page.
- **The Before / During / After loop:**
  - Add an upcoming real moment.
  - Rehearse it with Carla (with a surprise twist), and get a pocket card with 5 phrases and your first sentence.
  - Afterwards, tell Carla by voice how it went; what you couldn't say becomes new words.
- **Missing-words journal (carnet).** 30 seconds to say what you couldn't say, and Carla gives you the Spanish.
- **Interview pack per job ad:** what the recruiter wants, a checklist, the 10 likely questions with model answers, a cheat sheet and questions to ask.
- **Living curriculum.** "Ta semaine avec Carla" is built from your moments, errors and missing words.
- **Voice diary, grammar cards, coach corner.**
  - Voice diary: 1 minute a day, with a written reply.
  - Grammar cards: one per recurring error.
  - Coach corner: a weekly note for your partner.
- **Immersion:** a telenovela where you're the heroine, describe a generated picture, a daily micro-podcast with a quiz, and a per-word pronunciation score.
- **Milestones:** a monthly level check with a level card, and a practice oral exam inspired by the DELE A2/B1 format, with an indicative score.
- **n8n:** `/api/n8n/summary` now also returns ready-to-send `messages.reminder_fr` and `messages.sunday_fr`.
- Voice notes are stored in `data/audio` and kept 60 days. Generated scene images are cached in `data/images`.

### v0.1.0
First pilot: themed voice lessons with Carla, background feedback with history, memory, missions, duo mode and interviews from job ads.

## 1. Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key.
2. To start, the free tier is enough.
   - On the free tier, Google may use the data to improve its products.
   - Enable billing on the key's Google Cloud project when you want the paid tier. Paid-tier data isn't used that way, and rate limits are higher.
3. In AI Studio, check that the model IDs in `.env` exist (`GEMINI_LIVE_MODEL`, `GEMINI_TEXT_MODEL`). Google renames Live models often.
4. Set a budget alert on the Cloud project (e.g. €15/month).

## 2. Deploy on the Contabo server

**One command, from the Mac** (needs `ssh root@62.171.172.248` to work from your terminal):

```bash
./scripts/deploy.sh
```

The script copies the code and `.env` to `/opt/hablemos`, installs Docker if it's missing and opens ports 80/443 in ufw. It then checks whether something else already owns 80/443:
- If nothing does, it starts the app with Caddy (Option A below).
- If n8n's proxy does, it starts the app on `127.0.0.1:3000` only (Option B below) and tells you what's on those ports.

Run it again after every change.

### Manual deploy

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
4. Earphones help: Carla hears her better and doesn't hear herself.

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

## Automations with n8n

The app exposes `GET /api/n8n/summary`, protected with the `x-api-key` header (`N8N_API_KEY` in `.env`). It returns:
- `practicedToday`, `streak`, `dueWords`
- this week's and last week's minutes
- the top errors
- feedback failures from the last 2 days

From the n8n container, call it on the shared Docker network: `http://hablemos-app:3000/api/n8n/summary`.

Suggested workflows:
1. **Daily reminder (19:30):** Schedule → HTTP Request → IF `practicedToday` is false → send a message (Telegram, email or WhatsApp): "Carla t'attend : {{dueWords}} mots à revoir, 15 min ?" with `appUrl`.
2. **Sunday summary (18:00):** Schedule → HTTP Request → send an email: minutes this week vs last week, streak, top 3 errors to watch.
3. **Alert for you:** Schedule (hourly) → HTTP Request → IF `failedDebriefs` is not empty → notify Amine.

## Backups

`deploy.sh` installs a daily cron job, at 03:17 server time, that copies the database to `data/backups/`. Copies are kept for 14 days.

To restore a copy:
```bash
docker compose stop app
cp data/backups/hablemos-YYYY-MM-DD.db data/hablemos.db
docker compose start app
```
