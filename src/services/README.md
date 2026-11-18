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

One module per feature. Each exports plain async functions with typed inputs and outputs.

| Module | What it does |
| --- | --- |
| `supabase.ts` | Creates the Supabase client from `.env` |
| `auth.ts`, `AuthContext.tsx` | Log in, sign out, and the current session |
| `account.ts` | Creating an account (sign-up and the starting profile) |
| `profile.ts` | Reading your own profile and checking usernames |
| `courts.ts` | Nearby courts and court details |
| `checkIns.ts`, `location.ts` | Checking in and out, and reading the phone's location |
| `players.ts`, `searchQuery.ts` | Searching for other players and reading their profiles |
| `records.ts` | Win/loss records |
| `challenges.ts`, `challengeStatus.ts`, `challengeTime.ts` | 1v1 challenges |
| `errors.ts` | Turning server errors into messages screens can show |
| `database.types.ts` | Generated types (`npm run types`) |

`fakePlayers.ts` and the `STUB` sections in some modules are temporary sample data.
They get removed as each backend function is built, and screens don't change when
that happens.
