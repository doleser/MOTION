# End-to-end checklist

Manual checks that run the app against the hosted Supabase project, from a fresh install
to the expected result. They cover what the unit tests (Jest) and the database tests
(pgTAP) can't: the screens, navigation, and server working together on a real phone.

Each check lists what to do and what you should see. Mark each one **Pass** or **Fail**.
When a check fails, open a GitHub issue that names the check ID (for example `UC1-07`),
the device, and what you saw, then link the issue in the Notes column.

Use Case 3 needs the Nov 11 check-in and court migrations on hosted Supabase. Run
`npx supabase@2.122.0 migration list --linked` first: the remote column should end at the
same migration as `main`.

## Before you start

- **Build:** current `main`. Note the commit you tested.
- **Devices:** one phone running Expo Go, plus a simulator or emulator for UC1-17
  (denying location without changing your phone's settings) and UC1-25 (two devices at
  once).
- **Database access:** the Supabase dashboard's SQL editor, to check what the server
  saved. Ask Owen for access.
- **Test accounts:** use addresses like `e2e-uc1-beginner-MMDD@example.com`. If Supabase
  rejects the domain, use a `+` alias of your own email. Every account in this run gets
  the same password.
- **Fresh install:** delete Expo Go's data for MOTION, or sign out, so the app opens on
  the Welcome screen.

To check a profile, run this in the SQL editor:

```sql
select p.username, p.real_name, p.elo, p.open_to_challenges, p.position,
       p.height_cm, p.tags, c.name as home_court, p.onboarded_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.courts c on c.court_id = p.home_court_id
 where u.email = '<test email>';
```

## Use Case 1: a new player creates an account and gets a starting Elo

Spec: [LIVING_DOC.md, Use Case 1](LIVING_DOC.md#use-case-1-a-new-player-creates-an-account-and-receives-a-starting-elo-so-they-can-use-motion).

The app's sign-up order: Welcome → Sign up (name, email, password, 18+) → Username →
Profile details → Home court → Experience → Starting Elo → location prompt → Map.

### Run date: ______ Tester: ______ Device / OS: ______ Commit: ______

### Success scenario

| ID | Do this | Expect | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| UC1-01 | Open the app on a fresh install. | The Welcome screen shows a **Create Account** button and a way to log in. | | |
| UC1-02 | Tap **Create Account**. Fill in name, email, and password, but leave the 18+ box unchecked. | **Continue** stays disabled until all three fields are filled and the box is checked. | | |
| UC1-03 | Check the 18+ box and tap **Continue**. | The Username screen opens. | | |
| UC1-04 | Type a free username, such as `e2e_beg_MMDD`. | After a short pause, the screen says the name is available, and **Next** is enabled. | | |
| UC1-05 | Tap **Next**. On Profile details, pick a position, a height, and at least one play style, then go on. | The Home court screen opens with a list of courts from the database (the seeded UW courts). | | |
| UC1-06 | Pick a home court and tap **Next**. | The Experience screen shows Beginner, Intermediate, and Advanced, plus **Skip this step**. **See my starting Elo** stays disabled until you pick one. | | |
| UC1-07 | Pick **Beginner** and tap **See my starting Elo**. | The Starting Elo screen shows **400**, labeled provisional. The summary rows match what you entered: username, position and height, play styles, and home court. | | |
| UC1-08 | Tap a summary row, such as Username, change the value, and come back. | The row shows the new value, and the other answers are still filled in. | | |
| UC1-09 | Tap **Create account**. | A loading screen appears, then the app asks for location access. | | |
| UC1-10 | Allow location. | The Map opens centered on your position, with nearby courts shown. | | |
| UC1-11 | Open the Profile tab. | It shows the username, real name, **400** marked provisional, and a 0–0 record. | | |
| UC1-12 | In the SQL editor, run the profile query for this account. | `elo` = 400, `open_to_challenges` = true, `onboarded_at` is set, and the real name, position, height, tags, and home court match what you entered. | | |

### Starting Elo for each choice

Create one account for each row. Running UC1-01 through UC1-09 quickly is enough.
**Pass** means the Starting Elo screen, the Profile tab, and `profiles.elo` all show the
same number.

| ID | Experience choice | Expected Elo | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| UC1-13 | Intermediate | 800 | | |
| UC1-14 | Advanced | 1200 | | |
| UC1-15 | **Skip this step** | 800 | | |

### Variations

| ID | Do this | Expect | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| UC1-16 | Sign up, skip Profile details, and tap **Skip for now** on Home court. | Starting Elo shows "Not added" for position, height, and play styles, and "No preference" for home court. In the database, `position`, `height_cm`, `tags`, and `home_court_id` are null. | | |
| UC1-17 | On a simulator, sign up and **deny** location. | Sign-up still finishes, and the Map opens centered on UW. | | |
| UC1-18 | Close the app completely and reopen it. | You're still signed in, and the app opens on the Map, not Welcome. | | |
| UC1-19 | On Profile, tap **Sign out**, then log in with the same email and password. | The Welcome screen appears after signing out. After logging in, the Map opens and Profile shows the same Elo. | | |

### Errors

| ID | Do this | Expect | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| UC1-20 | On Sign up, enter `notanemail` and tap **Continue**. | "Enter a valid email address." You stay on Sign up. | | |
| UC1-21 | Enter a 5-character password and tap **Continue**. | "Password must be at least 6 characters." | | |
| UC1-22 | On Username, type `ab`, then `has space`, then a name with 17 or more characters. | Each one shows "Use 3-16 letters, numbers, or underscores." and **Next** stays disabled. | | |
| UC1-23 | Type the username from UC1-04, but with different capitalization (for example `E2E_BEG_MMDD`). | The screen says it's taken and suggests one free alternative. Usernames don't depend on case. | | |
| UC1-24 | Sign up again using the UC1-03 email with a **different** password, and go through to **Create account**. | You're sent back to Sign up with "That email is already registered. Try logging in instead." No second account appears in Authentication → Users. | | |
| UC1-25 | Two devices pick the same new username at the same time, then both tap **Create account**. | The first one succeeds. The second is sent back to Username with "Someone just took "…". Pick another username." Picking another name finishes the sign-up. | | |
| UC1-26 | Under 18: leave the 18+ box unchecked. | You can't continue past Sign up, and no row is added to Authentication → Users for that email. | | |
| UC1-27 | Log in with the UC1-03 email and the wrong password. | "Incorrect email or password." | | |
| UC1-28 | Turn on airplane mode on the Starting Elo screen and tap **Create account**. | An error appears above the buttons, and the app doesn't crash. Turn airplane mode off and tap again: the sign-up finishes with the same answers. | | |

### Where the app differs from the spec

These aren't failures in this run. Each one needs a decision: either change the app, or
change the spec in the living doc.

| Spec says | The app does | Decision |
| --- | --- | --- |
| Sign up with email, Apple, or Google | Email only. OAuth is #28. | Spec changed: email for the beta, OAuth planned. |
| The system verifies identity, and you can resend the verification email | Email confirmation is off. You're signed in right away. | Spec changed: no verification step. |
| Skipping the assessment gives 1200 | 800 (migration `20261103210648_skipped_level_elo_800`) | Spec changed to 800. |
| Show a rank tier with the Elo | No tier, because tiers aren't defined yet | |
| Ask for notification access | Only location is requested | |
| If location is denied, ask for a city or ZIP | Centers the map on UW | |
| Limit inconsistent answers to an Elo between 900 and 1500 | Doesn't apply: the assessment is one question | |
| If the email is registered, offer log in or account recovery | Shows a message. There's no button for either (#70). | |
| If the username is taken, show alternatives | Shows one alternative | |
| 4 assessment choices | 3 choices plus skip | |

### Cleanup

Delete the test users in Authentication → Users. Each user's profile is deleted with it
(`on delete cascade`).

### Results

- Passed: ___ / 28
- Issues opened:

## Use Case 3: a player checks in at a court

Spec: [LIVING_DOC.md, Use Case 3](LIVING_DOC.md#use-case-3-user-checks-into-a-court).

The app's check-in order: Map → tap a court pin → court card → Court details → **CHECK IN**
→ **VERIFY LOCATION** → (the server checks you're within 150 m) → Checked-in court
screen. A check-in lasts 3 hours. A pg_cron job closes expired check-ins every minute.

Run the success scenario **at a real court** with real GPS. Use the Prototype Controls
(**PROTOTYPE / LOCATION SCENARIOS** on the check-in sheet, shown only in Expo Go and
development builds) only for the rows that say so. Mark those rows "demo" in Notes.

Use two accounts from the Use Case 1 run: **A** on your phone, **B** on a second phone or a
simulator.

To check a player's check-ins, run this in the SQL editor:

```sql
select ci.check_in_id, c.name as court, ci.checked_in_at, ci.expires_at, ci.checked_out_at
  from public.check_ins ci
  join public.courts c on c.court_id = ci.court_id
  join auth.users u on u.id = ci.user_id
 where u.email = '<test email>'
 order by ci.checked_in_at desc
 limit 5;
```

### Run date: ______ Tester: ______ Device / OS: ______ Commit: ______ Court: ______

### Success scenario

| ID | Do this | Expect | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| UC3-01 | Signed in as A, at the court, open the Map. | Pins show real courts near you, from `nearby_courts`. The court you're standing at is among them. | | |
| UC3-02 | Tap that court's pin. | A court card opens with the name and a live player count. | | |
| UC3-03 | Open Court details. | It shows the court's details (lights, hoops, surface) and a **CHECK IN** button. | | |
| UC3-04 | Tap **CHECK IN**. | The **CHECK IN AT THE COURT** sheet shows the court name, **VERIFY LOCATION**, and **NOT NOW**. | | |
| UC3-05 | Tap **VERIFY LOCATION**. | **VERIFYING PROXIMITY** appears, then the checked-in court screen opens. | | |
| UC3-06 | Go back to the Map and look at this court. | The count is one higher than in UC3-02, without a refresh. | | |
| UC3-07 | In the SQL editor, run the check-in query for A. | One row for this court: `checked_out_at` is null, and `expires_at` is about 3 hours after `checked_in_at`. There's no latitude or longitude column. | | |
| UC3-08 | Signed in as B (signed out, or not at the court), watch the same court's count while A checks out and in again. | B's count updates live, but B can't see A's name. | | |
| UC3-09 | As A, on the checked-in court screen, tap **CHECK OUT**, then **CHECK OUT** on the **LEAVE THIS COURT?** sheet. | You're back on Court details with **CHECK IN**. The count drops by one. In SQL, `checked_out_at` is set. | | |

### Variations

| ID | Do this | Expect | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| UC3-10 | On **LEAVE THIS COURT?**, tap **STAY CHECKED IN**. | The sheet closes, and you're still checked in. | | |
| UC3-11 | Tap **CHECK IN**, then **NOT NOW**. | The sheet closes, and nothing is saved. | | |
| UC3-12 | While checked in at court 1, open Court details for another court and check in (demo: **LOCATION: AT THE COURT**). | "Already checked in" asks you to **Switch**. Tapping **Switch** checks you out of court 1 and in at court 2. Each count changes by one. | | |
| UC3-13 | Close and reopen the app while checked in. | The app still shows you checked in at that court (`get_my_check_in`). | | |
| UC3-14 | Two players: A and B both check in at the same court. | The count is 2. The court card shows an average Elo, which is hidden with fewer than 2 players. (The checked-in screen doesn't list players yet; `get_court_players` is wired in `checkIns.ts` but not on the screen.) | | |

### Failure scenarios

| ID | Do this | Expect | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| UC3-15 | Stand about 200 m from the court (a block away) and tap **VERIFY LOCATION**. | **MOVE CLOSER**, with **TRY AGAIN** and **BACK TO MAP**. Nothing is saved, and the count doesn't change. | | |
| UC3-16 | Walk back within 150 m and tap **TRY AGAIN**. | The check-in succeeds. | | |
| UC3-17 | Deny location for Expo Go (or demo: **LOCATION: PERMISSION DENIED**) and tap **VERIFY LOCATION**. | **LOCATION IS OFF**, with **RETRY LOCATION CHECK** and **KEEP BROWSING**. Court counts still show. | | |
| UC3-18 | Airplane mode (or demo: **LOCATION: UNAVAILABLE**), then **VERIFY LOCATION**. | **CANNOT VERIFY RIGHT NOW**. Nothing changes, and the app doesn't crash. | | |
| UC3-19 | In SQL, mark a court closed: `update public.courts set status = 'closed' where court_id = <id>;`. Then open its Court details. | **NOT AVAILABLE** instead of **CHECK IN**. Set the status back afterward. | | |
| UC3-20 | Expiry: in SQL, set A's open check-in to `expires_at = now() - interval '1 minute'`. Wait up to 1 minute. | The cron job sets `checked_out_at`. The court count drops without A doing anything. Opening the court shows **CHECK-IN REQUIRED**. | | |
| UC3-21 | Run `select jobname, schedule from cron.job;`. | `expire-check-ins` runs every minute (`* * * * *`). | | |

### Where the app differs from the spec

| Spec says | The app does | Decision |
| --- | --- | --- |
| Check-in is refused when the court is full | There's no player limit | |
| Check in a whole team at once | One player at a time | |
| The checked-in screen shows the type of runs | The players and the queue are a placeholder (README) | |

### Results

- Passed: ___ / 21
- Issues opened:
