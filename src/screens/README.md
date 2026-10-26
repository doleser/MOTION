# screens/

Full-page screens, one file per screen (e.g. `MapScreen.tsx`, `ProfileScreen.tsx`,
`CourtDetailsScreen.tsx`).

A screen:

- Lays out components from `components/` and shows data.
- Gets its data by calling functions in `services/`; it never calls Supabase directly.
- Is registered in a navigator in `navigation/`.

Keep screens thin. If a piece of UI is reused on more than one screen, move it to `components/`.
