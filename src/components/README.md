# components/

Reusable UI pieces shared across screens (e.g. `CourtCard.tsx`, `PlayerCard.tsx`,
`EloRankDisplay.tsx`, `CheckInButton.tsx`).

A component:

- Receives the data it shows through props.
- Does not fetch data or call `services/` itself; the screen that uses it does that.
- Does not know which screen it is on or navigate on its own; pass callbacks like
  `onPress` in from the screen instead.
