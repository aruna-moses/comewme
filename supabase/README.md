# Database

`schema.sql` creates the base backend. Paste it into the Supabase SQL editor on a
fresh project, then apply `migrations/012_community_guidelines_and_violations.sql`
to add current guidelines acceptance and moderation. Existing projects should apply
any unapplied migrations in order.

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
| `profile_media` | Anyone | Profile owner adds/removes | Only intentionally shared profile photos/videos are public |
| `reports` | Service role only | Anyone may file one | Reporters must not be exposed |
| `verifications` | Owner only | Owner inserts, admin decides | A selfie is the most sensitive thing here |
| `guideline_acceptances` | Owner only | Accepted through a guarded RPC | Each guideline version is recorded once |
| `violations` | Reported user only | Authenticated reports; moderator RPCs review | Report and enforcement history stays private |
| `violation_appeals` | Appealing user only | User submits; moderator RPCs decide | Appeals cannot be edited by the user |
| `moderators` | Moderator sees own membership | Project owner configures directly | No moderator is seeded by default |

## Triggers you should not remove

| Trigger | Job |
|---|---|
| `trg_sync_task_spots` | Keeps `spots_filled` and `status` correct when a join is accepted, declined or removed |
| `trg_guard_join_status` | Forces new applications to pending and serializes host acceptances against each task's spot limit |
| `trg_guard_profile_fields` | Stops a user editing their own `verification_status`, `trust_score`, `tasks_completed` or `no_shows` |
| `trg_on_task_completed` | Credits everyone who actually turned up |
| `trg_on_review_created` | Recomputes the trust score from real ratings, and never lets it drop |

The profile character selector stores the chosen personality on the profile; apply
`migrations/014_character_personality.sql` to an existing project before using it.
`migrations/007_profile_growth_character.sql` adds legacy character appearance fields.

The public profile gallery stores media in the public `profile-media` bucket and
metadata in `profile_media`. Apply `migrations/008_public_profile_media.sql` to an
existing project. Owners can manage only their own uploads; each profile is limited
to six media items.

Apply `migrations/009_group_member_profiles.sql` to allow activity hosts and accepted
participants to see accepted group members for profile discovery. Pending requests
remain visible only to their requester and the activity host.

Apply `migrations/010_host_reviewed_join_capacity.sql` to require host review for
every application, add waitlisted status, enforce accepted-member capacity, and
reopen an activity when an accepted member withdraws. Existing accepted members
are preserved even if an old first-come activity exceeds its posted capacity; new
acceptances remain blocked until the count is below capacity.

Apply `migrations/011_chat_replies_and_message_deletion.sql` to support quoted
replies and realtime soft deletion of a member's own group messages.

Apply `migrations/012_community_guidelines_and_violations.sql` to require acceptance
of guideline version 1.0, add private violation and appeal records, and enforce
guideline acceptance, warnings, and active bans for community write actions. It also
adds `/accept-guidelines`, `/violations`, and `/admin/moderation` workflows.

Apply `migrations/013_notification_badges.sql` after migration 012 to enable pending
application and unread-message badges. It adds private per-user chat read cursors,
RPCs for badge counts, and realtime publication for messages and join-request changes.

Apply `migrations/014_character_personality.sql` to let users select a profile
personality from the provided character portraits.

Apply `migrations/015_more_character_personalities.sql` to add the Burna and Chidi
character options.

Moderator access is intentionally unconfigured until the project owner chooses the
moderators. Add only trusted authenticated account IDs through the Supabase SQL
editor, for example:

```sql
insert into public.moderators (user_id)
values ('<trusted-auth-user-uuid>');
```

Moderation actions use restricted database functions. The browser never receives a
service-role key. Removing an account from `public.moderators` immediately removes
its moderation access.

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
