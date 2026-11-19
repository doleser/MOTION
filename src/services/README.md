# services/

Feature data modules. **This is the ONLY code that talks to Supabase.**

## Core rule

Screens never call the database directly; they call a function in `services/`.

```ts
// Good: the screen calls a service function
const courts = await getNearbyCourts(lat, lng, radiusMeters);

// Bad: the screen queries Supabase itself
const { data } = await supabase.from('courts').select('*');
```

## Why

- When a query, RPC or table changes, only the service changes, not every screen.
- Screens can be tested with a fake service, without a database.
- The backend is the source of truth. Services ask it for data and actions; they
  don't recompute game rules (Elo, check-in distance, queue order) on the phone.

## Layout

One module per feature, e.g. `auth.ts`, `profiles.ts`, `courts.ts`,
`checkIns.ts`, `challenges.ts`, `sessions.ts`, `results.ts`. Each exports plain
async functions with typed inputs and outputs.

## Errors

Every service throws a `ServiceError` (`errors.ts`) that has a `code` the screen can
check and a `message` it can show.

- Postgres raises `42501 'Not signed in.'`, or `22023` with a fixed message. The
  messages are listed at the top of each migration.
- The service maps each message to a `ServiceErrorCode` and uses its own text for the
  user, for example `fromCheckInError` in `errors.ts` and `fromChallengeError` in
  `challenges.ts`.
- A message that isn't mapped means a bug on our side. It's thrown as is, so
  `getErrorMessage` shows "Something went wrong."

When a migration adds or changes a message, update the service's map and its test.

## Testing challenges

Challenges need two real accounts; there's no fake data any more.

1. Sign up two accounts (finish sign-up on both).
2. Open `supabase/snippets/challenge_test_data.sql`, put the two usernames at the top,
   and run it in the SQL editor (local Studio, or the hosted dashboard for test
   accounts). It adds one challenge for each inbox section, plus a match that's
   ready for check-in. It's safe to run again.
3. Or send real ones: one account challenges the other from their profile.

`previewElo` in `challenges.ts` still returns fixed numbers until #106 adds the real
one to `results.ts`.
