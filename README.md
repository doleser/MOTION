# Motion

Motion is a mobile app for pickup basketball near the University of Washington. It shows which courts are nearby and gives a new player an account with a starting Elo rating.

## Living document

The living document is the project specification.

- In this repository: [docs/LIVING_DOC.md](docs/LIVING_DOC.md)
- Google Doc: <https://docs.google.com/document/d/1OS1WY_1IL6_StwLFAFapJgoJ0kooe2TsrqxzqifeNa0/edit?usp=sharing>

## What works in this beta

**Working use case:** Use Case 1, a new player creates an account and receives a starting Elo.

On a phone or emulator, after the database setup in [Backend](#backend):

1. Sign up with an email and a password (6+ characters) and confirm you are 18+.
2. Choose a handle (3–16 letters, numbers, or underscores) and optionally, position, height, and play style.
3. Pick a skill level. The server stores the starting Elo:
    - beginner: 400
    - intermediate: 800
    - advanced: 1200
    - *skipped:* 800
4. Pick a home court. That list is read from the `courts` table.
5. Open the Profile tab. The Elo shown there is read back from `profiles.elo`.

Sign-up creates the login and then saves the profile on the server. On the local database, the app does not ask you to confirm the email, so you stay signed in. Sign out from Profile, then sign in again with the same email and password.

**Not working yet:**

- The map pins, the court card, and the player counts are sample data stored in the app. They are not loaded from the database
- Check in shows "Check-in is coming soon"
- The Play tab is a placeholder
- Challenges, King of the Court, and confirming a result so Elo changes are not built

## Prereqs

- Git
- Node.js 22, including npm. [GitHub Actions](https://github.com/doleser/MOTION/actions) uses Node 22.
- The Expo Go app for Expo SDK 58, an iOS simulator, or an Android emulator.
- For the local database: Docker Desktop. The database commands below use `npx supabase@2.122.0`, the same version the automated tests use, so you do not install the Supabase tools yourself.

## Build

```bash
git clone https://github.com/doleser/MOTION.git
cd MOTION
npm ci
```

Copy the env example and fill it in after you pick a backend below.

```bash
cp .env.example .env
```

On Windows PowerShell, use `copy .env.example .env`.

`.env` is gitignored. It needs:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Backend

Use the local database below, or ask the team for the hosted project. Do not commit `.env`.

### Local (default)

Requires Docker. From the repository root:

```bash
npx supabase@2.122.0 start
```

That creates the tables from [supabase/migrations](supabase/migrations) and then loads [supabase/seed.sql](supabase/seed.sql), which inserts six courts near UW. The command prints an API URL and a public key, called the anon key. Put them in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key printed by supabase start>
```

`127.0.0.1` works for the iOS simulator, but a physical phone needs to use the computer's Wi-Fi address instead, because `127.0.0.1` would loop back to the phone. An Android emulator uses `10.0.2.2` in place of `127.0.0.1`.

Stop the local database with `npx supabase@2.122.0 stop`.

### Hosted

Our team runs a hosted Supabase project with the same tables. Ask for the API URL and anon key and put these in `.env`. The anon key is the public key that the app is meant to use, and the database still limits what that key can read and write. Do not put the service role key (which is an admin secret) in the app or in this file.

## Test

App checks, from the repository root (These do not need a database).

```bash
npm run lint
npx tsc --noEmit
npm test
```

Database checks. These need Docker. `supabase start` builds the database from the migrations and the seed. `supabase test db` runs the SQL tests in [supabase/tests/database](supabase/tests/database).

```bash
npx supabase@2.122.0 start
npx supabase@2.122.0 test db
```

To add an app test, put `src/services/<module>.test.ts` next to the module and run `npm test`. The example is [src/services/auth.test.ts](src/services/auth.test.ts). For a database rule, add a SQL test file under `supabase/tests/database/` and run `npx supabase@2.122.0 test db`.

GitHub Actions runs the app checks and the database checks on every push, and on every pull request to `main`. The workflow is [.github/workflows/ci.yml](.github/workflows/ci.yml). It does not use the hosted project. Runs are listed at <https://github.com/doleser/MOTION/actions>.

## Run

After `.env` is filled in:

```bash
npx expo start
```

The terminal prints a QR code. Scan it with Expo Go, or press the key it shows for an iOS simulator or Android emulator. Create an account as in [What works in this beta](#what-works-in-this-beta).

If you change `.env`, stop Expo and start again so the app reloads the new values:

```bash
npx expo start -c
```

## Repository layout

| Path | What it holds |
| --- | --- |
| [src/screens](src/screens/README.md) | One file per screen |
| [src/components](src/components/README.md) | Shared UI |
| [src/navigation](src/navigation/README.md) | Tab bar, stacks, and route types |
| [src/services](src/services/README.md) | The only code that talks to Supabase |
| [supabase/migrations](supabase/migrations) | Table definitions, in order |
| [supabase/tests/database](supabase/tests/database) | SQL tests for the database |
| [supabase/seed.sql](supabase/seed.sql) | The six seeded courts |
| [docs/](docs/LIVING_DOC.md) | The living document |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | Lint, type check, app tests, and database tests |
| [reports/](reports) | Weekly status reports |

## Reporting a bug

Open a [GitHub issue](https://github.com/doleser/MOTION/issues). Include the screen, the account you were using, and the error the server returned.

## Authors

Jace Baptista-Allan (jacedba), Joonho Choi (joonhoc7), Reed Dolese (doleser), Daniel Park (dpark005), Owen Jennings (owenjenn), Johnny Nguyen (dtn24)

## License

[MIT](https://choosealicense.com/licenses/mit/)
