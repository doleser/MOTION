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
