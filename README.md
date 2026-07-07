# Hefesto 🐱⚒️

**Never forget anyone again.**

Hefesto is a relationship-memory app. Tell it about the people you meet — by voice or
text, on the web or straight from Telegram — and it forges every note into a living
knowledge graph you can ask questions, get pre-meeting briefings from, and receive
gentle nudges when someone is going cold. An 8-bit blacksmith cat keeps you company:
he listens while you record, hammers away while your memory is forged, and taps you
on the shoulder when a briefing is ready.

Built for the **Cognee hackathon (Cloud track)** — every memory lives in
[Cognee Cloud](https://www.cognee.ai) as a per-user knowledge graph with a hand-made
relationship ontology.

## Try it

**https://hefesto.org**

- Tap **“Try the demo — pre-loaded memory”** on the login screen, or sign in with
  `judge@hefesto.org` / `forge-my-network` (a seeded network of six people).
- You can also create your own account (email + password, no verification) and start
  from zero — capture is a 15-second voice note.

Three questions worth asking the demo account:

1. *Who can introduce me to someone who runs a gaming studio?* — multi-hop recall with
   the walked path (You → Leo → Maya) rendered as Hefesto’s thinking.
2. *What should I talk about with Ana?* — personal mode: her dog Toby, the studio she runs.
3. *What should I talk about with Carlos?* — the same question flips Hefesto into
   networking mode: the designer intro he asked for.

**Telegram:** Account → **Connect Telegram** → scan the QR (or tap the button) →
`@HefestoMemoryBot`. From there: send a voice note about someone you met (inline
confirm card → your graph), ask anything with a “?”, or run `/briefing <name>`.
Cold-contact nudges land in the same chat.

## How it maps to Cognee Cloud

| Feature | Cognee Cloud API |
|---|---|
| Capture → memory | `POST /remember` (multipart) with `ontology_key=hefesto_relationships_v1` + `node_set=[cluster]`, `run_in_background` + status polling (“Hefesto is forging…”) |
| Relationship vocabulary | Hand-authored OWL ontology (`ontology/hefesto.owl`): Person, Company, Role, Interest, Event, Commitment… uploaded once via `POST /ontologies` |
| Chat recall + evidence | `POST /recall` `GRAPH_COMPLETION` (~4 s) with `include_references` — the Evidence block is parsed into quotes and the walked path |
| “Think deeper” | Same recall with `GRAPH_COMPLETION_COT` — deeper multi-hop reasoning, presented as a feature beat |
| Briefings | Person-scoped `GRAPH_COMPLETION` recall structured into title / summary / key points |
| Feedback (👍/👎) | `POST /remember/entry` with a `FeedbackEntry` (score 5/1) chained to the answer’s `qa_id` — retrieved via `GET /sessions/{id}` |
| Forget | Per-person: the app keeps a `person → data_ids[]` registry and deletes each `DELETE /datasets/{id}/data/{data_id}`; graph reads confirm the shrink |
| Graph view | `GET /datasets/{id}/graph` → warmth-colored embers, cluster glows, bloom animation |
| Multi-user isolation | One dataset per user (`user_{id}`). Cloud REST exposes no per-user principals on the data plane, so isolation is enforced app-side: every Cognee call derives its dataset from the session user — never from client input. Verified by the e2e gate’s cross-user checks. |

## Architecture

```
Next.js 16 (App Router, TypeScript)
├─ one URL, two real route trees: app/m (mobile) + app/d (desktop), served by proxy.ts
├─ route handlers = the whole backend (Cognee API key never touches the client)
│   ├─ /api/capture(+voice) → Groq: Whisper large-v3-turbo + llama-3.3-70b extraction
│   ├─ /api/chat · /api/briefing → shared recall pipeline (lib/answer, lib/briefing)
│   ├─ /api/telegram → bot webhook (deep-link /start, inline confirm, "?" recall, /briefing)
│   ├─ /api/telegram/link → one-time tokens (SHA-256, 10-min expiry) + QR
│   └─ /api/nudge · /api/feedback · /api/forget · /api/graph …
├─ Supabase — auth (email + Google) + small registry (persons, person_data,
│   conversations, telegram_links…, RLS on) for warmth, forget and disambiguation
├─ Cognee Cloud — the memory itself: per-user datasets, ontology, graph, sessions
└─ mascot engine — canvas + rAF pixel sprite, JSON clips, anchored one-shots,
    ambient blink/tail/doubt, reacts to listening/forging/thinking/errors
```

The Telegram webhook registers itself on every production boot (`instrumentation.ts`),
and the bot discovers its own username via `getMe` — zero manual steps per deploy.

## Local setup

```bash
npm install
cp .env.example .env.local   # or create it with the variables below
npm run dev
```

`.env.local` needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `APP_SECRET`, `COGNEE_API_KEY`, `COGNEE_BASE_URL`,
`GROQ_API_KEY`, and for the bot `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET`
(`TELEGRAM_BOT_USERNAME` optional — it self-discovers).

Gates (run from `app/`, they create and clean their own throwaway users):

```bash
npx tsx scripts/smoke-cognee.ts        # Cognee Cloud contract smoke test
npx tsx scripts/gate-e2e.ts            # capture → forge → recall → isolation → forget
npx tsx scripts/gate-f4-telegram.ts    # the bot, exercised with simulated updates
npx tsx scripts/gate-f4-demopath.ts    # the full timed demo journey, twice
npx tsx scripts/seed-demo.ts <email>   # reset the demo cast for an account
```
