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

For an existing deployment, apply any unapplied files in `supabase/migrations/` in
order. The community safety check adds `community_check_passed_at` to profiles;
apply `004_community_check.sql` before deploying the community-check flow. The
chat image and voice-note flow also requires `005_chat_media_delivery.sql`; it adds
the media columns, allows media-only message rows, configures participant-only
storage access, and enables realtime message updates.
Activity posting requires `003_fill_mode.sql`. Apply
`006_posting_moderation_and_capacity.sql` for uncapped positive participant counts
and report-review-based posting controls.
Apply `007_profile_growth_character.sql` to enable saved character customization
for the profile milestone journey. Progress uses the database-maintained count of
completed activities.
Apply `008_public_profile_media.sql` to enable the profile gallery. It creates a
public-read bucket for explicitly shared media and owner-only upload/delete access;
the gallery allows up to six photos or videos per profile.
Apply `009_group_member_profiles.sql` so activity hosts and accepted group members
can see each other's accepted member list in the group chat.
Apply `010_host_reviewed_join_capacity.sql` to require host approval for every join,
show waitlist/application status, and enforce the posted participant capacity.
Apply `012_community_guidelines_and_violations.sql` after the base schema on a
fresh project, or after earlier migrations on an existing project. It adds required
guidelines acceptance, private violation and appeal records, moderation actions,
and database enforcement for community access. The moderator allowlist starts empty;
configure trusted moderator user IDs in Supabase before using `/admin/moderation`.
Never put a service-role key in the browser.
Apply `013_notification_badges.sql` after migration 012 to enable realtime pending
application and unread group-message badges. It stores private per-user chat read
cursors and enables realtime publication for join-request changes.

An account is flagged for admin review after reports from three distinct users that
are still open or under review. Reports alone do not automatically suspend posting.
After reviewing the reports, an administrator can suspend posting by setting
`suspended_at` (and optionally `suspension_reason`) in
`account_posting_controls`; clear `suspended_at` to restore posting.

### 4. Enable Google sign-in (optional but recommended)

Supabase → **Authentication → Providers → Google** → enable.
You'll need a Google Cloud OAuth client. If that's a hassle, email + password works
out of the box — skip this and come back later.

Phone OTP sign-in also requires **Authentication → Providers → Phone** and a
configured SMS provider in Supabase. Email/password and Google remain available as
fallbacks. SMS delivery may incur provider charges.

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
