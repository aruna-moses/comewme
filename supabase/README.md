# Database

`schema.sql` is the whole backend. Paste it into the Supabase SQL editor on a fresh
project and it creates tables, indexes, triggers, storage buckets and every RLS policy.

Run it **once**. Re-running it is safe for the tables and policies (they use
`if not exists` / `drop policy if exists`), but any data you already have is left alone.

## What each policy is actually protecting

| Table | Read | Write | Why |
|---|---|---|---|
| `profiles` | Anyone | Owner only | Public task cards need a name and a face |
| `tasks` | Anyone | Owner (host) only | Public read is the no-login Discover feed |
| `join_requests` | Requester + that task's host | Requester creates, host decides | Nobody else can see who asked for what |
| `messages` | Host + accepted participants | Participants only | The whole point of this rebuild |
| `reviews` | Anyone | Participants, after completion | Reputation has to be public to be worth anything |
| `reports` | Service role only | Anyone may file one | Reporters must not be exposed |
| `verifications` | Owner only | Owner inserts, admin decides | A selfie is the most sensitive thing here |

## Triggers you should not remove

| Trigger | Job |
|---|---|
| `trg_sync_task_spots` | Keeps `spots_filled` and `status` correct when a join is accepted, declined or removed |
| `trg_guard_profile_fields` | Stops a user editing their own `verification_status`, `trust_score`, `tasks_completed` or `no_shows` |
| `trg_on_task_completed` | Credits everyone who actually turned up |
| `trg_on_review_created` | Recomputes the trust score from real ratings, and never lets it drop |

## Things that will bite you later if you forget them

1. **`is_task_participant()` is `security definer`.** That is deliberate — without it the
   policy would call itself recursively through `join_requests`. Do not "clean it up".
2. **There is no address column.** `meeting_point` is a public landmark. If you ever add
   an address field, you have undone the main safety guarantee of the product.
3. **No update policy on `verifications`.** Approving a verification means using the
   service role from an admin surface, or flipping it in the Supabase table editor by hand.
   That is fine for the first few hundred users.
4. **Deleting an auth user cascades** to their profile, tasks, joins, messages and reviews.
   Export first if you are removing a demo account on a live database.

## Free tier limits worth knowing

| | Supabase free |
|---|---|
| Database | 500 MB |
| File storage | 1 GB |
| Monthly active users | 50,000 |
| Projects paused after inactivity | 7 days, no traffic |

That last row matters: a free Supabase project goes to sleep if nothing touches it for a
week. The app wakes it on the next request, with a few seconds of delay. If you are
showing this to an investor, open the app once before the meeting.
