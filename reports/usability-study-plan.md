# MOTION usability study plan

## Scope

Test account setup, starting Elo, and court browsing in the native beta. The living document's second numbered use case is scheduling a ranked 1v1, which the beta's Play tab does not support yet. Use court browsing as the second study flow. The court activity shown in this build is sample data.

## Participants

- **P1 candidate:** An adult UW student who occasionally plays pickup basketball. They represent a player looking for a court around campus.
- **P2 candidate:** A different adult UW student or Seattle rec player who regularly plays pickup. They represent someone who already has a usual court and may want to see other options.

Before the first session, confirm both participants are new to MOTION, are outside the team and course staff, and update these descriptions to match them. Use P1 and P2 in shared notes and GitHub issues.

## Setup

1. Open the [participant landing page](../docs/usability/index.html) on the session device or a nearby laptop. Use a facilitator-provided phone with MOTION open to the welcome screen. A prepared iOS simulator or Android emulator also works for screen sharing.
2. Follow the [beta setup in the README](../README.md#run). On the exact device, build, and Supabase environment you will use, create a fresh test account, verify the app reaches the map, find the starting Elo in Profile, and open UW IMA. Check that registration returns a signed-in session. Local Supabase has email confirmation disabled by default.
3. Sign out before each session. Have a different, unused study email and temporary password ready for each participant. Have them choose a fictional handle. If the session is remote, check that the map opens around UW on the prepared device.

For a phone that already opens your Expo Go session, the landing page can show a launch button. Copy the `exp://` or `exps://` URL printed by Expo CLI and append it as `#expo=<encoded Expo URL>` to the landing-page address. For example, use `#expo=exp%3A%2F%2F192.168.1.20%3A8081` only if `192.168.1.20:8081` is your actual Metro address. The page accepts private IPv4 addresses and Expo's `exp.direct` tunnel hosts. Test the link on the exact phone before sharing it. For physical iOS, Expo Go and the CLI must use the same Expo account. Expo's tunnel reaches Metro, so the device still needs access to the configured backend.

If the team publishes the page through GitHub Pages, set **Settings → Pages → Deploy from a branch** to `main` and `/docs` after merging. Open the published project URL with `/usability/` appended and verify it before sharing. For an in-person session you can also open the HTML file locally.

## Tasks and success criteria

Read the prompts one at a time. Keep the success criteria on the facilitator side.

| # | Prompt to read | What counts as success |
| --- | --- | --- |
| 1 | “You’re new to MOTION and usually play at UW IMA. Set up an account you could use for pickup basketball.” | A new account with a unique handle reaches the map. Note whether the participant chooses UW IMA during setup. |
| 2 | “Now that setup is done, find the starting rating MOTION gave you and tell me what it is.” | The participant finds their saved rating and reads the value shown in Profile. |
| 3 | “You’re thinking about playing at UW IMA today. Find out whether it’s indoors and how many players MOTION shows there.” | The participant finds UW IMA and correctly reports the court type and the count displayed at that moment. |
| 4 | “Imagine you’re coming back to MOTION later. Sign out and get back into the same account.” | The participant signs out, signs back in, and can verify they are in the same account. |

## Session procedure

- Reserve 20–30 minutes for each session. Tell the participant, “We’re testing the app, and you can stop at any time. As you go, say what you’re looking for and what you expect to happen.” Ask for consent before starting and separately before any recording.
- For each task, record whether they completed it without help, completed it with help, or did not complete it. Write down actions, points of hesitation, and direct quotes. If they cannot make progress for a minute, give the minimum help needed and record it. Treat launch or sign-in trouble as a finding.
- Ask for their overall impression first. Then ask what was hardest, what was confusing, what they liked, what they would change, and whether they would use MOTION in daily life and why.
- Run P2 on a different day. Before P2, file one `user-study` issue per problem observed in P1 with anonymized evidence and reproduction steps. Triage the issues, fix what you can, and record any changes to the build or plan. Repeat issue filing and triage after P2. Keep names, emails, and recordings out of GitHub.
