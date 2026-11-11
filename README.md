# Motion

Motion is a mobile app for pickup basketball near the University of Washington. It shows which courts are nearby and gives new players an account with a starting Elo rating.

## Living document

The living document is our project spec.

- In this repository: [docs/LIVING_DOC.md](docs/LIVING_DOC.md)
- Google Doc: <https://docs.google.com/document/d/1OS1WY_1IL6_StwLFAFapJgoJ0kooe2TsrqxzqifeNa0/edit?usp=sharing>

## What works in this beta

**Working use case:** Use Case 1, a new player creates an account and gets a starting Elo.

On a phone or emulator, after following [Set up and run](#set-up-and-run):

1. Sign up with an email and a password (6+ characters) and confirm you're 18+.
2. Pick a handle (3–16 letters, numbers, or underscores). Position, height, and play style are optional.
3. Pick a skill level. The server stores the starting Elo:
    - beginner: 400
    - intermediate: 800
    - advanced: 1200
    - *skipped:* 800
4. Pick a home court. That list comes from the `courts` table.
5. Open the Profile tab. The Elo shown there is read back from `profiles.elo`.

Sign-up creates the login and then saves the profile on the server. You don't need to confirm your email, so you stay signed in right after signing up. You can sign out from Profile and sign back in with the same email and password.

**Not working yet:**

- The map pins, the court card, and the player counts are sample data stored in the app, not loaded from the database
- Check in just shows "Check-in is coming soon"
- The Play tab is a placeholder
- Challenges, King of the Court, and confirming a result so Elo changes aren't built yet

## Set up and run

You need Git, Node.js 22 (with npm), and the [Expo Go](https://expo.dev/go) app for Expo SDK 58 on your phone. An iOS simulator or Android emulator also works.

**1. Clone and install**

```bash
git clone https://github.com/doleser/MOTION.git
cd MOTION
npm ci
```

**2. Add the database keys**

Ask the team for the hosted Supabase URL and anon key. Then copy the example file (on Windows PowerShell: `copy .env.example .env`):

```bash
cp .env.example .env
```

and fill in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=<hosted URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<hosted anon key>
```

`.env` is gitignored, so don't commit it. The anon key is the public key the app is meant to use, and the database still limits what it can read and write. Never put the service role key (an admin secret) in `.env`.

**3. Start the app**

```bash
npx expo start
```

The terminal prints a QR code. Make sure your phone is on the same Wi-Fi as your computer, then scan it with Expo Go (Android) or the Camera app (iOS). For a simulator or emulator, press the key the terminal shows.

**4. Try it**

Create an account as described in [What works in this beta](#what-works-in-this-beta).

If you change `.env` later, restart Expo with `npx expo start -c` so the app picks up the new values.

## Test

App checks, from the repository root (these don't need a database).

```bash
npm run lint
npx tsc --noEmit
npm test
```

Database checks. These need Docker. `supabase start` builds the database from the migrations and the seed, and `supabase test db` runs the SQL tests in [supabase/tests/database](supabase/tests/database).

```bash
npx supabase@2.122.0 start
npx supabase@2.122.0 test db
```

To add an app test, put `src/services/<module>.test.ts` next to the module and run `npm test`. [src/services/auth.test.ts](src/services/auth.test.ts) is an example. For a database rule, add a SQL test file under `supabase/tests/database/` and run `npx supabase@2.122.0 test db`.

GitHub Actions runs the app checks and the database checks on every push and on every pull request to `main`. The workflow is [.github/workflows/ci.yml](.github/workflows/ci.yml). It doesn't use the hosted project. You can see runs at <https://github.com/doleser/MOTION/actions>.

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

Open a [GitHub issue](https://github.com/doleser/MOTION/issues). Include the screen, the account you were using, and the error the server gave you.

## Authors

Jace Baptista-Allan (jacedba), Joonho Choi (joonhoc7), Reed Dolese (doleser), Daniel Park (dpark005), Owen Jennings (owenjenn), Johnny Nguyen (dtn24)

## License

[MIT](https://choosealicense.com/licenses/mit/)
