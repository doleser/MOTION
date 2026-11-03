# Team resources

## Roles

| Team member | Role | Responsibilities |
| --- | --- | --- |
| Owen Jennings | Database, PM | Supabase/Postgres schema, migrations, row-level security, and PostGIS queries; the CI pipeline; sprint task tracking, status reports, and project documents |
| Reed Dolese | UI/UX | Screens and navigation in Figma, a consistent visual style, usability testing, and user guides. Repository admin. |
| Jace Baptista-Allan | Backend | Check-in validation, expiry, and automatic check-out; Elo calculation and result confirmation; King of the Court sessions and queue |
| Joonho Choi | Backend | Supabase client and authentication; challenge, result, and team-match functions; user privacy and security |
| Johnny Nguyễn | Frontend | Sign-up and login screens; 1v1 challenge, results, King of the Court, and team-match screens |
| Daniel Park | Frontend | Map, court sheet, and check-in screens; live court markers |

## Project artifacts

- **Code, issues, and pull requests:** <https://github.com/doleser/MOTION>
- **CI runs (GitHub Actions):** <https://github.com/doleser/MOTION/actions>
- **Living document** (the Google Doc is the source of truth):
  <https://docs.google.com/document/d/1Iv4nRQnxfLWo1CbQmWadlzeJVDBckgoaqx1jzAAFiJE/edit?usp=sharing>
  - Mirrored in the repo at [docs/LIVING_DOC.md](docs/LIVING_DOC.md).
- **Figma designs and prototype:**
  <https://www.figma.com/design/jTN8WKsfe4dxQ8Dpm8BvE6/MOTION-%E2%80%94-UI-DEMO?node-id=2-241&t=VWUW4ske8aWmPs3B-0>
- **Coding guidelines:** [coding-guidelines.md](coding-guidelines.md)
- **Database migrations and tests:** [supabase/](supabase/)
- **Hosted Supabase project** (database, auth, Realtime): ask Owen for dashboard access.
- **Expo (EAS) project:** `project-motion`

## Communication

| Channel | Used for |
| --- | --- |
| Team group text | Casual questions and quick coordination |
| GitHub Issues | Tasks and bugs |
| Pull requests | Code discussion and review |
| Tuesday section | Weekly team meeting: what's done and what's needed for the deliverable |
| Thursday section | Weekly project meeting with our TA, Yuki |

## Policies

- **Response time:** reply within 24 hours on weekdays. Escalate unresolved blockers to the
  PM (Owen).
- **Missing a meeting:** post in the group text if you can't make a meeting. If you'll miss
  Thursday section, email Yuki ahead of time.
- **Changes to `main`:** no direct pushes. Branch protection requires a pull request with
  one approval and passing CI.
- **Heads-up:** post in the group text when you open or merge a pull request.
