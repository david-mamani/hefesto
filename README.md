# Hefesto

Never forget anyone again.

Hefesto is a relationship-memory app: capture the people you meet in seconds and let a
living knowledge graph help you remember, reconnect, and follow up.

## Development

```bash
npm install
npm run dev
```

Copy `.env.local` variables before running (Supabase project URL and keys, app secret).

## Stack

- Next.js (App Router, TypeScript) — one URL, two device-specific route trees served
  dynamically (`app/m` mobile, `app/d` desktop) via `proxy.ts`
- Supabase — auth (Google + email) and application registry (RLS enabled)
- Cognee Cloud — memory layer (knowledge graph)
