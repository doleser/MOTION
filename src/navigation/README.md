# navigation/

Navigators and route types (React Navigation).

What belongs here:

- Navigators: the bottom tab bar for the main sections, and stacks for screens
  that open on top (e.g. Map → Court Details).
- Route types: TypeScript types listing each screen and the params it expects
  (e.g. Court Details needs a `courtId`), so navigating with wrong params is a
  compile error.

Screens themselves live in `screens/`; this folder only wires them together.
