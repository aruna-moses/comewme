# Come w' me

A Lagos social app. People post an activity they want company for — a market run, a
shared ride to the mainland, trying a buffet deal, meeting other devs — and others
request to join. The host approves, the group meets in a public place, and reputation
does the rest.

Built with **React + Vite + TypeScript + Tailwind**, **Supabase** (Postgres, auth,
storage, realtime), deployed on **Vercel**. All free tiers.

---

## Why this exists instead of Base44

| | Base44 free | This |
|---|---|---|
| Changes per month | ~3–5 credits | Unlimited |
| Chat privacy | Any logged-in user could read a task's chat | Enforced in the database |
| Export | Paid plan only | It's your repo |
| Platform risk | Pricing/policy can change under you | You own it |

The single most important difference is `supabase/schema.sql` → the `messages` RLS
policy. It enforces *"only the host and accepted participants can read this task's
chat"* at the database level, where it cannot be bypassed by the client.

---

## Setup — do these in order

### 1. Create your accounts (all free)

| Service | What you need | Link |
|---|---|---|
| **Supabase** | New project, region: closest to Lagos (EU/Frankfurt) | supabase.com |
| **GitHub** | One repo to hold the code | github.com |
| **Vercel** | Import the GitHub repo for hosting | vercel.com |

### 2. Get your Supabase keys

Supabase dashboard → your project → **Settings → API**. You need three values:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # server only, never in the browser
```

Copy `.env.example` to `.env` and fill them in.

> The service role key bypasses all security. Never commit it, never put it in a
> `VITE_` variable, never paste it anywhere public.

### 3. Create the database

Supabase dashboard → **SQL Editor** → New query → paste the entire contents of
`supabase/schema.sql` → **Run**.

That creates all tables, indexes, triggers, row-level security policies and storage
buckets in one go.

### 4. Enable Google sign-in (optional but recommended)

Supabase → **Authentication → Providers → Google** → enable.
You'll need a Google Cloud OAuth client. If that's a hassle, email + password works
out of the box — skip this and come back later.

### 5. Install and run

```bash
npm install
npm run dev
```

Open the local URL it prints. That's your app.

### 6. Seed demo data (optional)

```bash
npm run seed
```

Creates four demo users with Nigerian names and avatars, and eight open activities
across Yaba, Ikeja, VI, Surulere, Ajah and Lekki. Demo users have password
`password123` — delete them before you invite real people.

### 7. Deploy

Push to GitHub, import the repo in Vercel, add the same environment variables in
Vercel's dashboard, deploy.

---

## Project layout

```
comewme/
├── supabase/
│   ├── schema.sql          # tables, triggers, RLS — the backbone
│   └── README.md
├── scripts/
│   └── seed.mjs            # demo data via service role
├── src/
│   ├── lib/supabase.ts     # client + typed helpers
│   ├── types.ts
│   ├── components/
│   └── pages/
└── .env.example
```

## The trust model, in one table

| Data | Who can read it |
|---|---|
| Task title, area, date, host name/photo | Everyone, including logged out |
| Meeting point | Everyone (it must be a public landmark — never a home address) |
| Chat messages | Host + accepted participants only — enforced by RLS |
| Phone number | Owner only |
| Verification selfie | Owner + service role only |
| Reports | Service role only |

## Rules that must not be broken

1. **`meeting_point` is a public landmark.** Nothing else. There is no address field
   in the schema, and there should never be one.
2. **`tasks_read` stays public.** It's what makes the no-login Discover feed work.
3. **Never read `messages` with the service role in the browser.** That bypasses the
   participant check and leaks private chat.
4. **`spots_filled` is maintained by a trigger**, not counted by the client.
