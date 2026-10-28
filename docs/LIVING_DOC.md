# Motion

# 1. Team info

| Team member | UW NetID | Primary role |
| :---- | :---- | :---- |
| Reed Dolese | Doleser | UI/UX |
| Joonho Choi | joonhoc7 | Backend |
| Jace Baptista Allen | jacedba | Backend |
| Owen Jennings | owenjenn | Database, PM |
| Johnny Nguyễn | Dtn24 | Frontend |
| Daniel Park | dpark005 | Frontend |

**Project artifacts:**

- Github: <https://github.com/doleser/MOTION>
- Living Document: <https://docs.google.com/document/d/1Iv4nRQnxfLWo1CbQmWadlzeJVDBckgoaqx1jzAAFiJE/edit?usp=sharing>
- Figma: <https://www.figma.com/design/jTN8WKsfe4dxQ8Dpm8BvE6/MOTION-%E2%80%94-UI-DEMO?node-id=2-241&t=VWUW4ske8aWmPs3B-0>
- Other links (to be added)

**Communication:** Text message, github, Google Drive, Email, in person

# 2. Product Description

## Abstract

Motion is a mobile app for pickup basketball in Seattle. It shows basketball players which nearby courts are active right now and which friends are playing there. Players are able to check in at a court, track which court has “motion” and find details about a specific court. Players check in at a court, see live activity and court details, and play games that update an Elo rating. Users can see court info and player counts before checking in, but can only see who is playing after checking in at that same court. Motion takes all the guesswork out of trying to play pickup basketball.

## Goal

Help pickup players answer three questions quickly: "Is anyone playing at a court near me?", "Where are my friends playing?", and "Can I find a game at my level?" The system lets users discover courts, see live activity, check in, challenge a similar-rated player, join or host King of the Court, and arrange a team match. We are focusing on 1v1s for the MVP. Team games, team creation, and filling open spots on the teams are planned for later. Earlier team-game descriptions are kept for reference.

## Current Practice

Most pickup games at parks are played through word of mouth or by just showing up and hoping there are people playing. Friends that exist outside of these runs can organize basketball games through methods such as group chats or facebook groups. Several products cover one piece of this and leave the rest out:

- [Hoop Maps](https://techcrunch.com/2017/03/22/no-sweat-hoop-maps-makes-finding-a-game-of-pickup-basketball-as-easy-as-a-tap/) schedules and shows maps in-progress pickup games on a map. However, it does not have a player rating system and does not have court feature descriptions (e.g. lights, rims, nets).
- [Google Maps Popular Times](https://support.google.com/business/answer/6263531) estimates how busy a place tends to get, based on the past visits. It does not keep a live count of who checked in, nor is it tied to a game.
- [Snap Map](https://help.snapchat.com/hc/en-us/articles/7012335066644-How-to-use-Snap-Map) shows where your friends are. It does not track games or courts; it is simply a location sharing feature.
- [Strava segments](https://support.strava.com/hc/en-us/articles/216918087-Strava-Segments) rank people on a recorded activity after the fact. They do not help find a game that is currently happening.
- [Playtomic](https://playerhelp.playtomic.com/hc/en-gb/articles/19832151055121-How-to-sign-up-for-an-Open-Match-Padel-Tennis) fills padel and tennis matches by skill level. Competitive matches change a rating, and casual matches do not. It depends on paid club bookings, and it is not built for public basketball courts.
- [Chess.com](http://chess.com) uses an Elo rating system to match opponents. The matching has nothing to do with a place or with who is there, as the games are conducted online.
- Group chats and [Meetup](https://www.meetup.com/) help coordinate people, but they cannot predict when courts are occupied, nor do they connect users to a network of other people who can join into a game.

## Novelty

Currently, there are no app that gives users

1. Complete information about a court (double rim, lights, nets, etc)
2. Real time activity updates
3. An Elo rating system for competitive matches.

Motion puts these pieces together. A player can see that a lit court nearby has enough people at a similar rating before leaving home. Motion would be the first to give players all the information they would need before showing up to play pickup basketball.

## Effects

The first version is for Seattle. A player who is new to a neighborhood, or who wants a game at their level, can find a court and a match without a group chat. A successful Motion app will give players all around Seattle more options to play basketball. Expanding past Seattle is a stretch goal.

# 3. Use Cases (Functional Requirements)

Team check-in, the team result variation, and Use cases 6 and 7 are future features. These earlier requirements are kept for reference.

## Use Case 1: A new player creates an account and receives a starting Elo so they can use MOTION.

### Primary Actors

- New player

### Secondary Actors

- Sign-in provider (email, Apple, or Google)
- Location service

### Triggers

- The new player opens the app for the first time and taps Get started.

### Preconditions

- The app is installed and the device is online.
- No account exists yet for the player's email or sign-in identity.

### Postconditions (success scenario)

- A verified account exists with a unique handle.
- A provisional starting Elo is assigned in every mode, with its rank tier.
- Challenge availability is set to open to challenges.
- The player is on the map with nearby courts shown.

### List of steps (success scenario)

1. New player taps Get started and chooses a sign-up method.
2. New player enters credentials and confirms they are 18 or older.
3. System creates the account and verifies the player's identity.
4. New player chooses a handle and optionally adds position, height, and play-style tags.
5. System presents the skill self-assessment with 4 choices: (Beginner: “I’ve never played basketball”, Intermediate: “I know the rules and can keep score”, Advanced “I’ve played organized games”)
6. New player completes the self-assessment. (Beginner: 400, Intermediate: 800, Advanced: 1200)
7. System shows the starting Elo and rank tier, labeled provisional.
8. New player grants location and notification access and picks a home court from nearby suggestions.
9. System opens the map.

### Extensions/variations of the success scenario

- 2 alt - Player signs in with Apple or Google. System skips the verification message. Return to step 4.
- 4 alt - Player skips the optional profile fields and can complete them later. Return to step 5.
- 6 alt - Player skips the assessment. System assigns the default starting Elo of 1200. Return to step 7.
- 8 alt - Player denies location access. System asks for a city or ZIP code to center the map. Return to step 9.
- 8 alt - Player skips the home court and can set it later. Return to step 9.

### Exceptions: failure conditions and scenarios

- 1 - Player is under 18. Registration stops and no data is kept. Use case ends.
- 2 - Email is already registered. System offers log in or account recovery. Use case ends.
- 3 - Verification message does not arrive. The player can resend it. An unverified player can browse but cannot send or accept ranked challenges. Return to step 3 after a resend, or continue at step 4 unverified.
- 4 - Handle is taken. System shows available alternatives. Return to step 4.
- 6 - Assessment answers are inconsistent or extreme. System limits the starting Elo to between 900 and 1500. Return to step 7.

## Use Case 2: A player arranges a ranked 1v1 with a similar-skill opponent at an agreed court and time.

### Primary Actors

- Challenger

### Secondary Actors

- Challenged player
- Calendar app

### Triggers

- The challenger taps Challenge on an opponent's profile, a leaderboard row, or a court sheet.

### Preconditions

- The challenger is logged in, verified, and has completed placement.
- The opponent has a verified account.

### Postconditions (success scenario)

- The challenge is accepted, with court, date and time, ranked setting, and score target.
- Both players are told, can see the match, and receive reminders.
- A calendar event exists for each player who allowed calendar access.
- Elo has not changed. Elo changes only after Use Case 4.

### List of steps (success scenario)

1. Challenger opens the opponent's profile.
2. System shows the opponent's Elo, rank, win rate, play style, and head-to-head record.
3. Challenger taps Challenge and chooses ranked, court, date and time, and score target.
4. System shows the Elo stakes (e.g., WIN +16 / LOSE -14).
5. Challenger sends the challenge.
6. System delivers the challenge to the challenged player.
7. Challenged player reviews the details and accepts.
8. System confirms to both players and adds the match to their calendars.

### Extensions/variations of the success scenario

- 3 alt - Challenger chooses casual instead of ranked. System shows no Elo stakes in step 4, and result posting is optional. Return to step 5.

### Exceptions: failure conditions and scenarios

- 3 - Chosen time conflicts with another scheduled match. System warns the challenger, who keeps the time or changes it. Return to step 3.
- 5 - Opponent is not open to challenges. System offers to follow the player instead. Use case ends.
- 5 - Elo gap is more than 150 points. System blocks the ranked challenge and suggests a casual challenge. Return to step 3 if the challenger switches to casual. Otherwise, use case ends.
- 5 - A pending ranked challenge with this opponent already exists. System opens the existing challenge. Use case ends.
- 5 - Opponent has blocked the challenger. System shows "player unavailable" without revealing the block. Use case ends.
- 7 - Opponent declines. The pair cannot challenge each other again for 24 hours. Use case ends.
- 7 - Opponent does not respond before the challenge expires (24 hours, or the scheduled start, whichever comes first). Return to step 3 if the challenger resends. Otherwise, use case ends.
- 8 - Calendar access is denied. The match stays in the app with in-app reminders. Use case ends, except the calendar event.

## Use Case 3: User checks into a court

### Actors:

- User trying to check into a court to play on

### Triggers

- When the user hits “join court”

### Preconditions

- Court still has availability
- User has an account created
- User’s location is at the court

### Postconditions (success scenario)

- After the user has checked into the app, the live counter increments.
- The average Elo rating of the court updates.

### List of steps (success scenario)

1. User arrives at a nearby court
2. The app validates the location, ensuring the user is at the physical location
3. User clicks on the location, and a “check-in” button pops up, alongside the live counter, the court’s average Elo rating, and the type of runs that are happening on the court.
4. Adds the user to the court if all requirements pass (location, court availability)
5. Live counter increments by one, and the average Elo rating of the location is updated.

### Extensions/variations of the success scenario

- Instead of every team member checking in separately, a team member can check in, and the platform automatically checks in all team members.
- Only allow teams to check in if all team members are at the location.

### Exceptions: failure conditions and scenarios

- The court has reached its limit of players (need to kick users off a court if they leave the court by checking their physical location)
- User tries to join the queue or court when they are not physically at the court.
- The court is under renovation or closed, so users can check into the court. (We should display this information. Instead of the check-in button, we should have a “Not Available” button.)

## Use Case 4: Players record who won so Elo and records update fairly.

### Primary Actors

- Reporting player

### Secondary Actors

- Confirming player (the opposing side)

### Triggers

- After a game, the reporting player taps Post Result

### Preconditions

- A match has ended (See use cases 1, 3, 5)
- No result for the match has been posted yet.
- Both players are checked into the current session.

### Postconditions (success scenario)

- The result is reported.
- For ranked games, Elo changes, win/loss, and match history are recorded
- Any rank-tier changes are applied.
- If match is over, both sides see a shareable result card and match summary

### List of steps (success scenario)

1. Reporting player taps Post Result.
2. System asks who won.
3. Reporting player selects the winner.
4. System previews the Elo change, and the reporting player submits the result.
5. System asks the other player to confirm.
6. Other player taps Confirm.
7. System finalizes the result and applies the ELO changes.
8. System shows both players a summary with the ELO change, rank movement, and a share card.

### Extensions/variations of the success scenario

- 7 alternative: The game is inside a session that continues (best of 5, King of the Court) after a game is played. System only records the win/loss and does not show a result card, and elo changes are deferred until the end of the session. End use case.
- 3 alternative: Reporting player optionally enters the final score. Continue to step 4.
- 4 alternative: The match is casual. System does not change ELO, and there is no confirmation. Continue to step 8.
- 3 alternative - Team match. A captain reports the winner, and the opposing captain confirms for the team. Return to step 7.
- 3 alternative - both actors attempt to report the winner. If consistent, the system confirms. Continue with step 7.

### Exceptions: failure conditions and scenarios

- 6 - Confirming player does not respond within 24hr. System confirms the reported result automatically. Continue to step 7.
- 6 - The confirming player disputes the winner or both players attempt to report a different winner. The system voids the match with no elo changes and issues a warning to both players. If this is a player’s 5th warning in the last month, the system blocks them from selecting or playing ranked games for a week. End use case.

## Use Case 5: A group runs King of the Court at a court with a queue.

### Primary Actors

- Player who starts the session

### Secondary Actors

- Participants
- Next player in queue

### Triggers

- The session host taps King of the Court at a court

### Preconditions

- Players are signed into the app
- At least two players are at the same court and ready to play
- No other Motion session is running at that court.
- Players must be physically at the location to check in, run king of the court, and inspect the queue.

### Postconditions (success scenario)

- The app saves the results of the games, updates players’ win/loss records, and the king of the court is determined.
- The queue is cleared, and the court status returns to normal.
- For ranked sessions, Elo change was applied.

### List of steps (success scenario)

1. Player selects king of the court on the app and starts a session
2. System opens the session, shows a join code, and marks the court in progress
3. Friends join the session, and the system updates the list and queue accordingly
4. The first two players play a game
5. Winner reports the win and the loser confirms with one tap
6. The system records the win/loss, then the winner is deemed the king of the court, with a crown icon and current streak displayed
7. The winning player stays on the court, and the losing player goes to the back of the queue.
8. The group repeats steps 4 to 7.
9. Host ends the session. System shows the final King, top streak, and win/loss table, and saves it to each player's history.

### Extensions/variations of the success scenario

- Additional players or friends want to join in on an in-progress session. They are able to enter the back of the queue to play. Players are also able to leave the queue if they are done playing without affecting the ongoing session.
- Host hands hosting to another participant before leaving. Return to step 8.

### Exceptions: failure conditions and scenarios

- A player leaves, and fewer than 2 players remain. System ends session.
- A player leaves during a game. System voids the game, and the next player steps in. Return to step 4.
- A match is not completed so nothing gets recorded, or if players disagree about a result. Then none of the recording happens. The host may void the game.
- A player cannot check in and join King of the Court if they are far from the location. System displays a message notifying that the user cannot check in and join the queue.

## Use Case 6: A group with an open roster slot finds a compatible player so the game stays full

### Primary Actors:

- Group member

### Secondary Actors:

- Joining player
- Rest of the group

### Triggers:

- One of the players in the full game leaves, and they set a hotspot “looking for ONE MORE player”
- Outside player sees this opening

### Preconditions:

- The group is checked in at the court as an active game with an open slot.
- The group member is on that roster.
- The joining player is logged in with a verified account.
- Group size is 4, 6, or 10 (2v2, 3v3, and 5v5).

### Postconditions (success scenario):

- The court is once again marked as “full” once the player joins
- The joining player is on the roster and checked in at the court.
- The listing is closed and removed from the court sheet, map, and feeds.

### List of steps (success scenario):

1. One of the players in the game needs to leave
2. In-app, players mark the game as “looking for 1 more”
3. New player is looking for a game to join
4. In-app, the new player is of a similar ELO and sees “looking for 1 more”
5. New player walks up to court and confirms with the players already there
6. In app, the now full court removes “looking for 1 more” and a new game is started!

### Extensions/variations of the success scenario:

- Two or more players are needed, “looking for 1 more” would become “looking for X players”
  - A court can also shrink team sizes if too many people are missing to fill teams.
    - If the total number of players missing is two or greater, a popup will appear on the session host’s device asking them if they would like to shrink the team size.
    - If the host accepts, the session will reduce team size appropriately, and the “looking for X players” listing will now be open for X - 2 new players.
    - If the resized teams are now full, the court will be marked as full and the “looking for X players” listing is closed and removed from the court sheet, map, and feeds.
    - A court will automatically be resized to the smallest possible size after 30 minutes of missing two or more players, unless the session host disables this feature in the session settings.
- If a court wishes to increase team sizes, they must close the current session and open a new one.
  - The remaining players will receive a notification on their device that a new session has been opened at their current location, and users may open the notification to join that session.
- Another full game is ready to take the court as the group missing 1 searches for another player while taking a break

### Exceptions: failure conditions and scenarios:

- Too many players request too few spots. System keeps the earliest requests and offers the others a waitlist spot.
- If a player attempts to join a court during a resizing operation and the court would be over capacity if they join, then their attempt will be declined.
- If a session is terminated while a player attempts to join it, the join attempt will be declined.
- ELO mismatch on a ranked game. System prevents joining player from joining the ranked game.
- Joining player does not arrive within 20 minutes. System reopens the listing.

## Use Case 7: A group forms a team and arranges a match with another team

### Primary Actors

- Group A (Host Team)

### Secondary Actors

- Group B (Incoming Team)

### Triggers

- All members of Group A indicate that they are looking for another team to play against at a specific time and location.
- A member of Group B sees this opportunity on the map.

### Preconditions

- No other Motion session is running at the selected court at the specified time.
- All members of both Group A and Group B are available at the specified time.

### Postconditions (success scenario)

- The court is marked “full” once Group B joins.
- The joining group is checked in at the court.
- The listing is closed and removed from the court sheet, map, and feeds.
- Elo changes as documented in Use Case 4 for each individual player.

### List of steps (success scenario)

1. Group A coordinates ahead of time to meet at a specified time and place.
2. Once that specified time comes, all members of Group A meet, and one member will begin a session.
3. System opens the session and shows a join code, marks the court as “looking for a team of x”, where x is the size of Group A.
4. Group B, a group of the same size as Group A, sees the opening on Motion.
5. Group B travels to the court and confirms with Group A.
6. Group A marks the court as “full,” and a new game is started.

### Extensions/variations of the success scenario

- 4 alt - If Group A selects the “ranked” option when beginning their session, their session will indicate this, and the average ELO of Group B must be within 150 points of Group A’s for Group B to see and join the session. The session will show the stakes (e.g. WIN: +16 / LOSE - 14)
- 6 alt - If the session is ranked, each member of the losing group will lose ELO while each member of the winning group will gain ELO based on the ELO distributions of both groups.

### Exceptions: failure conditions and scenarios

- **If no full group is available to join Group A, Group A can open the session to ad-hoc teams, which is exactly Use Case 6, and players could join individually rather than as a team.**
- **If Group A loses players but wishes to maintain team size, Group A can open the session to ad-hoc teams, which is exactly Use Case 6, and players could fill open spots individually.**
- If Group A loses players before finding Group B and wishes to continue, the players who leave can leave the session, and the vacancy in the session will adjust accordingly.
- If multiple members of Group A attempt to start the session, only one session will begin, and the other will be declined as the court is now occupied.

## Use Case 8: Player disagrees with a game result and posts an appeal.

### Primary Actors

- Player 1 who’s trying to appeal the result

### Secondary Actors

- The player who Player 1 played against.

### Triggers

- After the system has updated a player’s record and game result history, Player 1 disagrees with the result and presses the appeal button.

### Preconditions

- Player 1 is not in time-out. A player enters time-out after submitting at least 5 appeals that were all rejected by the opponent. A player in time-out cannot submit appeals for 30 days.
- The appealing player is logged in.

### Postconditions (success scenario)

- The player submits an appeal successfully and waits for the opposing player's response.

### List of steps (success scenario)

1. The opposing player views the result of a game and clicks the appeal button.
2. The system displays an appeal page asking the player to submit their reasoning for the appeal. The reason is chosen from a pre-defined list.
3. The system confirms that the player is not in timeout, initializes an appeal, and sends it to the opposing player.
4. If the opposing player accepts the appeal, the game counts as a win for the user. The system updates Elo for both sides.

### Extensions/variations of the success scenario

- Alternate Response: Since not all appeals mean “give me the win”, player 1 can request a different outcome (void, a draw). If the void or draw appeal is accepted, neither player receives a win for their record.
- No Response: After 5 days and the opponent hasn’t responded in time, the appeal would be approved by the system. The player’s Elo gets updated accordingly.
- Deleted Account: If the opponent’s account is deleted, the appeal would be approved by the system.
- Counter: The opponent can propose a different outcome, sending an appeal back to the player. If the player rejects the appeal, this would count as an appeal rejection for both players.

### Exceptions: failure conditions and scenarios

- Player in timeout: If the player is in timeout, a rejection screen is displayed, notifying the user that they cannot make an appeal.
- Repeated rejections against one player: If the player has submitted more than 5 appeals against a specific player and all have been rejected, the system notifies the player that they are no longer eligible to challenge the other player in a ranked match for the next 15 days.

# 4. Non-Functional Requirements

- Privacy is ensured and user data is secure. Users can see court info and player counts before checking in, but can only see who is playing after checking in at that same court. Traffic uses HTTPS, and the entire database has row-level security.
  - **To check:** a test account reads another user’s row and gets no coordinates.
- Safety. Blocking and reporting is available and findable from a profile.
  - **To check:** test with 10 subjects and assess whether they are all able to find and block/report a profile.
- Performance is up to par. While storing 500 courts, a search for courts returns a result within 1 second and the real time map displays within 1 second of opening it, both >95% of the time when connected to a 5G network. Check-ins are visible to other devices within 5 seconds.
  - **To check:** A test device assesses the timing of a query with 500 dummy locations stored, and checks court availability 5 seconds after a second device checks out the dummy location.
- New users can sign up and check into a court in under 2 minutes.
  - **To check:** test the sign-up process with 10 independent test subjects, and find their 80th percentile time to sign up.

# 5. External Requirements

- Robust: The server rejects handles with abnormal symbols or outside of the 3-16 character range, impossible or out-of-range scores, and check-ins from outside a 150 meter radius. If the network drops and causes an action to fail (completing a check-in, sending an invite, posting results, sending chats), the panel stays on screen and the user is prompted to retry the action.
  - **To check:** automated testing for all rejection cases above, including on airplane mode or disconnected from a signal.
- Other people can run it: The README will have an Expo GO QR code, and the Supabase project is already hosted, so a tester can scan the code and reach the map. No desktop build is required.
- Building: the README will cover cloning the repo, the .env file, starting a Supabase project, migrations, and Expo.
  - **To check:** a test subject outside the team can follow the README and build Motion with the seeded courts.
- The four concrete goals for the first working product, excluding the stretch goals, are achievable within the given time frame for a team of 6 people, all based in Seattle.

# 6. Team Process Description

## Software Toolset:

- **Frontend:** React Native + Expo & TypeScript
  - Libraries like React Navigation and Expo Location accelerate development with a reliable, tried-and-tested implementation.
  - TypeScript helps ensure correctness and readability of code with static typing and provides internal documentation through TypeDoc
  - React-native-maps: Used for the map.
- **UI/UX:** Figma
  - Used to design and prototype the app’s different screens, navigation, and user interactions. It also will allow us to share designs with the frontend team and keep the interface consistent during development.
- **Backend:** Supabase + JWT Auth
  - Supabase’s PostgreSQL database with PostGIS will handle geographic data, simplifying data management.
  - JWTs integrate well with mobile apps, and their scalable cryptography ensures that sensitive user data is kept private.
- **Tooling:** GitHub Actions, EAS Build/Submit, Sentry
  - GitHub Actions and EAS Build/Submit integrate smoothly with the tech stack for easy CI/CD.
  - Sentry provides distributed tracing, allowing for simplified error tracking.
- **Testing:** pgTAP, Jest, Supabase CLI, ESLint, SQLFluff
  - pgTAP tests the database and Jest tests the client.
  - Supabase CLI runs a local database in CI.
  - ESLint and SQLFluff enforce the coding guidelines on pull requests.

## Risks

### Risk Assessment 1. Attracting Initial Users

**Likelihood: High**
**Impact: High**
One of the major challenges with MOTION is actually getting people to start using the app, especially considering there aren't that many players on the app yet. Since MOTION relies on people regularly checking into courts, a lack of users could make some of its main features less useful. This is one of the main reasons we decided to limit MOTION to the Seattle area initially, with most of our focus on the courts around UW. By starting in a smaller area, we hope to build a consistent group of players and generate interest before expanding to other locations. Since we are UW students ourselves, we can actually visit the courts, talk directly with players, show them how the app works, and get feedback on what features they'd see themselves using. Talking to these players early would also help us get a better idea of how interested people actually are in using the app.

One idea we had was organizing a small tournament or pickup event. This could potentially involve a local basketball celebrity, like a former NBA player or current UW basketball player to help attract attention. We also think MOTION can still be useful with a small number of users. Even a group of friends could use the app to challenge each other, track their records, and compete against each other in the King of the Court feature. We were thinking even the six of us group members could have fun playing with each other on the app without needing a larger user base. Hopefully by starting with smaller groups and building relationships with players around UW, we can grow the number of active users and encourage people to regularly check in while playing around the area.

We can see how well this is working by tracking the number of users signing up, how often they're checking in, and whether they continue using the app over time. If we're struggling to attract users we can focus more on getting smaller groups of friends and players at a few popular courts to use MOTION, while using their feedback to figure out what would encourage more people to participate.

**Changes since submitting our requirements:** After getting feedback from Yuki, where she had concerns about how we would attract players, we added this risk and made a plan on how to attract players by focusing on smaller groups and players around UW, as well as a potential tournament.

### Risk Assessment 2. Feature Scope

**Likelihood: Medium**
**Impact: High**
In order for MOTION to succeed, the features delivered at launch must be comprehensive without being rushed or unpolished. While there are a virtually endless number of features that MOTION could support, only a few can be implemented within the project timeline. Being overambitious with features may result in an unprofessional final product, bugs that ruin user experience, or even catastrophic security issues. On the other hand, an overly conservative features list may result in MOTION having a lackluster effect on users, where the limited scope dissuades users from even using the application. As a result, miscoping the project’s features poses a huge risk to MOTION’s success.

We acknowledge that some features are must-haves, and some are simply nice-to-haves. Certain features, like user ELO calculations, can be refined over the post-deployment lifecycle of MOTION. On the other hand, features like user privacy and basic matchmaking are essential for MOTION to deploy. We believe that implementing features in order of importance will accelerate the development process, while ensuring that MOTION can endure disruptions in the development timeline. Additionally, we plan on reducing complex features to extensions of smaller features, so that implementation is simplified when the basic features are implemented. For example, ranked 5v5 matchmaking is essentially ranked 1v1 matchmaking, but with team entities rather than player entities, and ranked 1v1 matchmaking is essentially casual 1v1 matchmaking, but with additional features like ELO stakes.

### Risk Assessment 3. Frontend/Backend don’t integrate until late in the schedule

**Likelihood: Low**
**Impact: High**
**Evidence:** To get MOTION into the hands of users, we want to have MVP features working at every stage. We’ve already identified attracting initial users as a risk, and if we don’t have an aligned MVP, we don’t have anything to put into their hands. **To reduce the likelihood** of this happening, we are going to have each feature written and planned out from users to data before implementation. Frontend and backend engineers will also be paired in developing new features. **To detect this risk** our week 3 slice build will serve as our estimate for the rest of the flows; UI/UX, frontend, backend, database will all be aware of dependencies and who may be falling behind. **To mitigate this,** if we find that features aren’t up to date, we will redistribute efforts among the team to catch that up. As was raised in the feature creep section as well, if we find that a feature is holding us back, we will consider refactoring or cutting it in order to have a working MVP on our timeline. **Changes since submitting requirements:** We had outlined “failure to collaborate” in our original requirements document. This risk assessment tightens our visibility on the failure point and will keep us accountable in development.

### Risk Assessment 4. App introduces too much friction in how basketball is played

**Likelihood: Medium**
**Impact: High**
Playing pickup basketball has been around for decades and people have figured out various tricks and resources to make it work. The whole process of making an account, having to check-in to the court, join a queue, and just having to pull out your phone at the courts can introduce too much friction leading users/players to stray away from the app. This would be a massive problem as our app would be introducing more problems/issues than the problems that it’s supposed to solve. Therefore, as we build the components of this app, we must always be thinking about what problem this app solves and how this app makes pickup basketball easier. If we get caught up in adding various features that would be nice to have, not only is the work not as fruitful, but we add friction that drives away users. We can know what it is that we really need to build through building a baseline MVP of what we see as the non-negotiables. Then from there, we will use surveys and market research to see what sticks and what isn’t necessary. From that baseline, we look to invite players by showing them what problem we can solve. Nice to have can always be added but a user/player comes for the non-negotiable and not the nice to have.

### Risk Assessment 5. Collected court map data is incorrect or too sparse

**Likelihood: High**
**Impact: Medium**
As of October 20, 2026, the Seattle Parks Basketball Court Points service returns 66 locations and Basketball Court Polygons returns 83. This does not cover every hoop in the city.

To **reduce** the likelihood of this issue: two hoops from two different sources that fall on the same court location are stored on one row, so that the map does not show duplicate pins. A weekly refresh pulls in new reported courts and checks the sources again to keep the database updated with the most courts marked as possible. We can manually ensure courts and their features near campus, where the largest playerbase would likely be, are recorded in the database.
To better **detect** this risk occurring, each new import leaves behind a log of the new rows inserted/updated/rejected. Owen can manually review these for potential issues. Player reports of incorrect/missing courts are filed into Github Issues.
To **mitigate** the risk in the case that this issue occurs, local courts are all manually verified and reviewed and fixed before the beta release. Any manual corrections to the database after an incorrect recording will override future automated changes to the same row.

### Risk Assessment 6. Real-time state is inconsistent across user’s devices.

**Likelihood: High**
**Impact: High**
Many of Motion’s features depend on live data: seeing a court’s check-ins/player count, queueing up for a King of the Court game, finding a player to form a team with, etc. When multiple users update the data at the same time, or when a phone loses its connection, their devices can show out of sync data. This can cause features to break such as the player count for a court being incorrect or two players might think they’re next in line.

To reduce the likelihood of this risk, all game logic and live data are kept in the backend, as we maintain the database as a single source of truth. The frontend should not do any calculations, store copies of backend data as states, or have the ability to change the data in the database directly. Instead, the frontend should process data requests via the features modules. When a user loses connection, phones should refresh the app and refetch outdated information to ensure consistency.

To detect this risk occurring, automated tests will login with test users, try out functionalities that require live data and check whether updates reach all users within 5 seconds. Additionally, we can test the database’s ability to process concurrent requests by having the test send conflicting requests simultaneously and verify that the database stays consistent. To mitigate this risk in the case that this issue occurs, Motion can fall back to reloading data every few seconds.

### Timeline Risks:

#### Drastic revisions in product deliverables and functionality:

- Because this is a living document, changes are likely and expected. However, if these changes cause major setbacks in implementation and design, then the timeline may become infeasible for the project term.
- Revisions going completely different directions can also lead to wasted work being done and falling behind schedule.

#### Failure to effectively collaborate:

- By the nature of being a team project, significant collaboration is required. Should communication be insufficient, merging work may cause significant delays in the project timeline. Additionally, should some members fail to meet their project deadlines, the group as a whole may fall behind schedule. As a result, group members should hold each other accountable while maintaining thorough communication.

#### Critical Issues in Tech Stack:

- Software tools and services like Expo are prone to outages or sudden dependency issues, which may interrupt development. Should those issues occur and fail to resolve promptly, an alternative solution may have to be implemented, which would still put the development schedule at risk.

We foresee that the most challenging part about this project is getting everything to work together in real time across multiple different users. There will be tradeoffs in how quickly the map updates, and getting every client to show the same count is a real accomplishment. Court locations from OpenStreetMap and the city dataset will be incomplete. Player reports can handle missing or wrong data. Additionally, a player who walks away without checking out would make a court look busier than it is. Expiring time and automatic check-outs handle this issue. The other risk is scope: the first viable product is the five features below, in Seattle only.

### Major Features:

1. King of the Court
2. ELO - based matchmaking
3. Create Teams/Matchmaking (Creating Teams is planned for later)
4. Court Check-in and Check-out
5. Map of live activity updates

### Stretch Goals:

1. Implement other sports
2. Expand outside of Seattle
3. Avatar Implementation
4. AI-assisted team making

## Role Descriptions:

### Jace - Backend

| | |
| --- | --- |
| **What?** | Server-side game logic: Elo calculation and result confirmation, King of the Court session and queue state, check-in validation, expiry, and automatic check-out, and any real-time court status updates that these all depend on. |
| **Why?** | I build VR physics labs in Unity for NOMR at UW. The work is backend-heavy: the simulation state has to stay consistent and accurate while it updates in real time. Similar challenges will be faced for Motion's sessions, queues, and live court counts. |

### Joonho - Backend

| | |
| --- | --- |
| **What?** | Server-side logic: User account authentication, player-to-player and team-to-team interaction and challenge match functions, user privacy and security, and any real-time court status updates that these depend on. |
| **Why?** | I have previous project experience creating API endpoints for a React Native + Expo application that interfaces with a database, an architecture much like that of Motion. I have a strong understanding of cross-technology services, so I will be comfortable routing API calls and connecting clients to the server. Additionally, I have created user account authentication and data encryption services, as will be needed to manage user data and interaction in Motion. |

### Reed - UI/UX

| | |
| --- | --- |
| **What?** | Design the app’s screens, navigation, and user interface/flow in Figma. Keep a consistent style throughout and work alongside the front-end team to get the designs implemented. Also work on testing the app with users, getting feedback, and making changes to designs as needed. |
| **Why?** | I have a background in art and have worked on UI/UX projects in the past. I also made the Figma prototype and demo that we used in our video, which included screens for lots of our key features like the map, king of the court, and profile. This already gave me a general understanding of how users will move through the app and what info they need at each part. I plan to continue to work on developing the user interface and design while working on functionality with the rest of the team. |

### Daniel - Frontend

| | |
| --- | --- |
| **What?** | Mobile app development, design/architecting system/product that is efficient and working |
| **Why?** | Experience working on mobile frontend development at 2 internships |

### Owen - Database, PM

| | |
| --- | --- |
| **What?** | Designing and maintaining the Supabase/PostgreSQL schema with courts, users, sessions, matches, ELO history, challenges, and queues. Implementing RLS to protect privacy.  Assigning and tracking tasks within sprints, updating documents. Heading the CI/CD pipeline. |
| **Why?** | I have experience working in Databases and designing schema from a past internship, and I’ve coordinated a software team at a club here at UW in a PM role. |

### Johnny - Frontend

| | |
| --- | --- |
| **What?** | I build the screens for Motion’s game features, starting with the auth screens, 1v1 challenges, King of the Court, and team matches. For the user login flow, I ensure that the user input valid login details. For the 1v1 challenges, I ensure that users are able to schedule rank or unranked matches. For the King of the Court screen, I ensure that users are checked in and queued up properly. For the team matching functionality, I ensure that users can find their teammates and form a team. |
| **Why?** | I have had previous experience working on front-end development for a web development club and an internship experience. |

## Member Timelines:

|  | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 | Week 6 | Week 7 | Week 8 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| UI/UX (Reed) | Tech Stack Finalized **(2-4 hours) COMPLETE** | Complete Screen Mockups and Navigation in FIGMA **(6-8 hours) COMPLETE** | Finalize all the UI Components and Hand Off Designs to Frontend Team **(6-8 hours)**  | Work with Frontend team to Complete UI For One Full Use Case and Help with UI Fixes **(6-8 hours)** | Initial Usability Testing,  Identify UI issues and Write User Guides  **(4-6 hours)** | Debugged, Product Ready for User Feedback  **(4-6 hours)** | Implement Feedback & Nice-To-Haves via CI/CD **(4-6 hours)** | Final UI Testing, Debugging, Deployment! **(4-6 hours)** |
| Frontend, map (Daniel) | Expo app scaffolded with navigation **(2-4 hours)** | Map renders seeded courts **(2-4 hours)** | Court sheet and check-in screens (Use Case 6) **(3-5 hours)** | Live markers for courts on screen **(3-5 hours)** | Check-in edge states **(4-6 hours)** | Map and court sheet covered by end-to-end tests **(4-6 hours)** | Implement Feedback & Nice-To-Haves via CI/CD **(5-7 hours)** | Final Tests, Debugging, Deployment! **(4-6 hours)** |
| Frontend, games (Johnny) | Navigation shell **(2 hours) Done** | Auth screens against the auth stub **(2-4 hours) In progress**  | Sign-up flow (Use Case 4) **(4-6 hours)**  | 1v1 challenge and post-result screens (Use Cases 1, 7) **(4-6 hours)** | King of the Court and fill-a-spot screens (Use Cases 3, 2) **(4-6 hours)** | Team match screens (Use Case 5), with end-to-end tests passing **(4-6 hours)** | Implement Feedback & Nice-To-Haves via CI/CD **(6-8 hours)** | Final Tests, Debugging, Deployment! **(4-6 hours)** |
| Backend, contract (Joonho) | Supabase client and generated types **(2 hours)** | Auth complete **(4-6 hours)** | Challenge and team-match function signatures on main **(2-4 hours)** | Challenge and result functions the screens call **(4-6 hours)** | Team-match functions **(4-6 hours)** | Contract covered by end-to-end tests **(6-8 hours)** | Implement Feedback & Nice-To-Haves via CI/CD **(4-6 hours)** | Final Tests, Debugging, Deployment! **(4-6 hours)** |
| Backend, live state (Jace) | Function layout for game rules **(2 hours)**  | Check-in validation stub **(4 hours)** | Check-in expiry and automatic check-out **(4-6 hours)** | Elo and result confirmation **(5 hours)** | King of the Court session and queue **(5 hours)** | Live-state rules covered by tests **(4 hours)** | Implement Feedback & Nice-To-Haves via CI/CD **(4-6 hours)** | Final Tests, Debugging, Deployment! **(6-8 hours)** |
| PM (Owen) | Tech Stack Finalized **(2-3 hours)** | Set up basic CI **(4-6 hours)** | Add Database to CI, run first tests **(5-7 hours)** | Write E2E checklist **(4-6 hours)** | Run E2E checklist **(6-8 hours)** | Recruit testers & Prep Usability Protocol **(4-6 hours)** | Run Usability tests & Document Feedback **(6-8 Hours)** | Write README & Prep Demo **(4-6 hours)** |
| Database (Owen) | Draft Schema **(2-3 hours)** | Write Migrations **(4-6 hours)** | RLS Policies & PostGIS Queries Implemented **(5-7 hours)** | Configure Realtime & Review Seed Import **(3-4 hours)** | Fix Database bugs **(3-5 hours)** | Measure Performance against NFR standards **(2-4 hours)** | Migrate Feedback Changes **(3-5 hours)** | Deploy Production Database **(2-4 hours)** |

**Initial User Testing and Success Checks**

Weeks 5-7: Reed and Owen will test with ten users alongside end-to-end testing. We’ll track check-ins, queue joins, completed games, repeat use, and where users need help. If users can’t finish the main flow without help we will fix it and test again.

## External Milestones

| Project Week | Milestone | Due date  |
| :---- | :---- | :---- |
| Week 1 | Proposal and Requirements | October 13, 2026 |
| Week 2  | Architecture & Design | October 20, 2026 |
| Week 3 | Testing & CI | October 27, 2026 |
| Week 4 | Beta Release | November 3, 2026 |
| Week 5  | Refinement — Implementation and Documentation | November 10, 2026 |
| Week 6 | Peer Review | November 17, 2026 |
| Week 7  | Users | November 24, 2026 |
| Week 8  | Final Release | December 1, 2026 |
| After Week 8 | Final Presentation — Live Demo and Group Reflection | December 11, 2026, 8:30–10:30 a.m |
| Every Week  | Weekly Status Report | Mondays by 11:59 p.m.  |

## Dependencies:

### UI/UX Dependencies - Reed

The frontend team will need the screen mockups and shared components before finishing the UI. We can start testing navigation with the Figma prototype, but testing a full interaction like checking into a court will need the screens, location check, and backend check-in working together. Feedback from testing will help us decide what changes to make, and we’ll test those parts again after the changes are implemented.

### Backend Dependencies - Joonho

The backend team will need to work very closely with frontend developers to determine what queries to make to the backend database, and when. Implementations will be done with the expectation that changes will be necessary before merging with frontend. Unit tests will ensure basic correctness, but mock users will be necessary to test backend functionality thoroughly.

### Frontend Dependencies - Johnny

The frontend will need to work closely with the backend team to agree on API contracts so that the received data matches what each screen needs to show and that minor changes in the service layer doesn’t cause refactoring the entire interface. This also ensures that both teams can work in parallel during the development process without the need to rely on one another to finish. The frontend team will also need to work closely with the UIUX team to flag edge cases or alternate paths which may require new screens or changes to existing ones. Frontend Developers can test the interface by covering edge cases, such as empty, loading and error states, lost connections and invalid input.

### Database Dependencies - Owen

Before building: The schema migration has to happen before functions or services can be written against it.

Before testing: RLS policies must exist before the first end-to-end slice.

Before a full use case: Use case 3 can be run once the migration, RLS, `check_in`, the check-in service, and the court screen are all merged.

## Test plan & bugs

### Usability Tests - UI/UX

We plan to have people outside of our group to try the app and do things like find a court, check in, and send a challenge. Everyone will try the same tasks without us walking them through it. We’ll keep track of whether they finish and where they get stuck or need help. We also want to see if people understand why they have to check in before seeing who is playing. We’ll also interview them afterward to see what they thought of the app and get their suggestions on what we could improve. We’ll also do the timing and block/report checks listed in our non functional requirements with ten testers. Along with finding courts and sending challenges these tasks will help show us whether new users can get through the main parts of the app without our help.

**Backend/Database tests**
We test rating changes, court counts, check-in privacy, and new user journeys.

- **Unit tests:**  pgTAP: reject a check-in at 200 meters, reject a ranked Elo gap over 150, a void leaves profiles.elo unchanged, names stay hidden until check-in, and confirm_result writes profiles.elo and elo_history together. pgTAP checks each RLS policy with two test accounts (one checked in, one not). Jest tests each **services/** module with Supabase.
- **Integration:** GitHub Actions runs that pgTAP suite on a local Supabase with the migrations and seed. One simulator and one emulator confirm a check-in appears on the second phone within 5 seconds (Section 4). CI applies every migration to an empty database on each pull request, and times **nearby_courts** against 500 seeded courts (Section 4).
- **Usability:** Ten outsiders, with no walkthrough, sign up, find a court, check in, send a challenge, and find block and report (Section 4). We record where they stop, change the design, and rerun those tasks.
- **Bugs:** Each failure in testing or use is a GitHub Issue with the screen, account, and server response.

### External Feedback:

- External feedback will be most important to create an intuitive, pleasant UI. This can be obtained through surveys and usability testing while in the design phase.

# 7. Software Architecture

## Components

- **Screens:** Draw what a feature data module returns, and send user actions to that module. They do not call the database.
- **Feature data modules:** One module per feature, turning a screen action into a connector call and sending the result back.
  - **Map data module:** Gets nearby courts including names, status, player counts, and distances. Also receives activity updates so the map stays current.
  - **Court data module:** Gets updates when checkins or sessions change and updates the court info shown on the screen .
  - **Check-in data module:** Sends selected court and user’s location to the Check-in component. Returns the check in status or an error to the screen and sends the user's response to “still here?” back. The data module handles communication, while the Check-in component checks the location and manages check-ins and check-outs.
  - **Results data module:** Sends the match and winner to Rating. Returns the Elo preview, updated rating, or the voided result and warning to the screen.
  - **King of the Court data module:** Sends session request to Court session and returns the player’s place in the queue to the screen. The court session manages the queue, crown, and streak.
  - **Team data module (Future):** Sends the session and requested format to Team match. It returns the new team size or an error if the change is not allowed.
- **Supabase Auth**: Email, Apple, and Google sign-in. Sits between the frontend and database and provides an API to process and store user authentication info in the database.
- **Check-in:** Accepts a reading within 150 meters, closes the check-in when a reading is outside that radius, expires a check-in after 3 hours, and asks "Still here?" when readings stop. It stores which court and when, never a coordinate.
- **Rating:** The only writer of ratings and rating history. It previews and applies Elo when a result is confirmed. A dispute voids the match and writes a warning.
- **Court session:** Keeps the King of the Court queue, the crown, and the streak. When a player leaves or the session ends, it calls Rating. It does not compute Elo.
- **Postgres and PostGIS:** Tables, indexes, and row-level security. The nearby-courts query answers "what is near me?"
- **Court importer:** A scheduled job reads Seattle open data and OpenStreetMap and updates the court list. Players can also report a missing or wrong court.
- **User/account:** Manages profiles, friendships, blocks, reports, challenges, and appeals. Uses Supabase Auth for signing in.
- **Team match:**  Changes the team format and size for a session. Rejects changes that would include a player outside the Elo range in a ranked session.

## Interfaces

- **Screens** send a user action to a **feature data module** and the module returns the data the screen draws.

**Supabase Auth**

- Feature data module sends sign-in request to Supabase Auth. Supabase Auth returns a session or an error

**User/account**

- Feature data modules send the user’s session and requests for profiles, friendships, blocks, reports, challenges, and appeals to User/account. User/account returns the request data, a confirmation of a change, or an error.

### Check-in

- The phone sends its latitude + longitude to the **check-in data module**.
- The **check-in data module** sends a court and a location reading to **Check-in**. **Check-in** answers with the open check-in, a distance error, a confirmation that the player is still there, a completed check-out, or a request to ask "Still here?" The **data module** sends the player's answer back.

### Rating

- The **results data module** sends a match, a winner, and an optional score to **Rating**. **Rating** answers with a preview of the Elo change, the applied Elo, or a voided match and a warning.
- **Court session** sends **Rating** the player and the mode when that player leaves, or when the session ends if they are still in it. **Rating** returns the applied Elo. A King of the Court game records the win and loss immediately and does not call **Rating** for that game.

### Court session

- The **King of the Court data module** sends a session to **Court session** and receives the player's place in the queue.

### Postgres and PostGIS

- The map data module sends a location and a radius to **Postgres** and receives each nearby court's identity, name, status, player count, and distance.
- Any data module asks **Postgres** for rows. **Postgres** returns only the rows that row-level security allows that caller to see.
- **Postgres** announces a changed check-in or session to the map and court data modules, and those modules replace the marker from the announcement.
- **Check-in**, **Rating**, and **Court session** each write only their own tables in **Postgres**.

### Team match (Future)

- The team data module sends a session and a new format to Team match. Team match answers with the new size, or with an error when a ranked session would include a player outside the allowed Elo range.

### Court importer

- **Court import** writes updated court rows into **Postgres**.

## Data storage

- **Overview.** MOTION stores user accounts and profiles, basketball courts and their features, check-ins, social links (friends, blocks, reports), challenges, sessions, games, appeals, warnings, and Elo history. Our expected scale is about 100 courts and tens of users. Tens of users is a rough estimate for testing and early use. We’re starting small with a focus on people around UW, then plan to grow within Seattle.

### Storage approach:

- One Supabase Postgres database with the PostGIS extension. Accounts are managed by Supabase Auth, each account has one **profiles** row.
- Courts are seeded and refreshed weekly from OpenStreetMap and Seattle Parks data by the Court importer, which is safe to re-run and won’t overwrite a manual correction to court data
- Check-ins, sessions, games, appeals, warnings, and Elo are written by the server. Profiles, friendships, blocks, reports, and challenges are written by users, restricted by RLS.

### Court data

Court locations and details come from four sources, seeded before launch and corrected by players:

- [OpenStreetMap](https://wiki.openstreetmap.org/wiki/Tag:sport%3Dbasketball) queries using Overpass API: leisure=pitch and sport=basketball . Tags such as lit, indoor, and hoops can be collected for some of the court details.
- Seattle Parks and Recreation publishes [Basketball Court Points](https://data-seattlecitygis.opendata.arcgis.com/datasets/SeattleCityGIS::basketball-court-points) and [Basketball Court Polygons](https://data.seattle.gov/dataset/Basketball-Court-Polygons/e5iu-8tia), refreshed weekly.
- Players can report a missing or wrong court.

### Schema:

The MVP uses 1v1 king of the Court sessions. Team mode and team size options are reserved for later.

| **Table** | **Key columns** | **Purpose** |
| --- | --- | --- |
| **profiles** | user_id PK → auth.users, username UNIQUE, elo (default 1200), open_to_challenges | App data for each account, including the current Elo rating. |
| **courts** | court_id PK, name, location (PostGIS point), lit, indoor, hoop_count, surface, status, source + source_ref UNIQUE, manually_edited | One row per court with its features. source records which dataset it came from; manually_edited stops the importer from overwriting a correction. |
| **check_ins** | user_id → profiles, court_id → courts, expires_at, checked_out_at | One row per visit. Active while checked_out_at is null and expires_at (3 h) hasn't passed. |
| **friendships** | PK(requester_id, addressee_id) → profiles, status | Friend requests and accepted friendships, one row per pair. |
| **blocks** | PK(blocker_id, blocked_id) → profiles | Users a player has blocked; hides each from the other. |
| **reports** | reporter_id, reported_id → profiles, reason | Reports of a player, kept for review. |
| **challenges** | challenger_id, opponent_id → profiles, court_id → courts, scheduled_at, ranked, status | A proposed 1v1 game and its response. |
| **sessions** | court_id → courts, host_id → profiles, type ('koc', 'team'), ranked, team_size, started_at, ended_at | A King of the Court or team-match session at a court. |
| **session_players** | PK(session_id, user_id), queued_at, left_at | Players in a session; KOC queue order is queued_at. |
| **games** | court_id → courts, session_id (nullable), challenge_id (nullable, UNIQUE), ranked, status, winning_side, reported_by → profiles | One played game, from a challenge or a session; pending until the other side confirms. |
| **game_players** | PK(game_id, user_id), side | Who played in each game and on which side. |
| **appeals** | game_id → games, appellant_id → profiles, requested_outcome, status | Appeals of a finalized result,  time-outs are counted from rejected appeals. |
| **warnings** | user_id → profiles, game_id → games | Issued when a disputed result is voided; the ranked ban counts the last month's rows. |
| **elo_history** | history_id PK, user_id → profiles, game_id (nullable), session_id (nullable), elo_before, elo_after | Each rating change and the game or KOC session that caused it. |

## Assumptions

- The first version holds the Seattle seed, on the order of 100 courts, and several tens of users. That user estimate is for testing and early use around UW. Section 4 already requires the nearby query to stay under 1 second at 500 courts.
- The phone has a network connection to play. There is no offline mode.
- Testers open the app in Expo Go. Background location doesn’t run there, so Check-in receives a reading when the app is open and relies on the 3-hour expiry otherwise. The rule is the same one.

The Supabase project stays on the free tier, and the database fits in the free size limit.

## Architecture decisions

**Supabase and Postgres functions:** Game rules are Postgres functions in the Supabase project and the client calls them by name.

- **Alternative:** A Node and Express server that holds the rules and talks to Postgres
- **Pros:** Easier to debug in a language the whole team writes. It can sit in front of the database with its own tests
- **Cons:** A second codebase, a second deploy, and a place for the rules to drift from the tables. Row-level database security and the rule wouldn’t run in that same transaction. Fewer moving parts are preferred for 6 people in the 1-quarter timeline.

**Realtime, instead of polling:** The map subscribes to the courts on screen and updates the marker when a row changes.

- **Alternative:** The client polls the nearby-courts query every few seconds.
- **Pros:** Simpler, and it works inside Expo Go with no channel setup.
- **Cons:** Two phones wait for the next poll to show the same count. It wakes the radio more often and makes the "check-in within 5 seconds" requirement depend on the poll frequency.

# 8. Software Design

## Frontend (UI/UX)

We plan to split the frontend into different screens and reusable UI components. Things like player cards, buttons, and Elo displays will be used throughout the app so we don't have to make them separately.

### Code Organization

We plan to organize the frontend into the following folders:

### Screens:

- `screens/`: Contains the main screens, such as MapScreen, CourtDetailsScreen, ProfileScreen, and KingOfTheCourtScreen. Each screen brings together the Ui components and handles the info and interaction described above.
- **Log-in / Sign-Up Screen:** Allows the user to create an account, log in, set up their profile, and receive a self-assessed Elo rating.
- **Map Screen:** Displays nearby courts, with player counts, and live activity.
- **Court Details Screen:** Overview of the court and its features. Users can see the number of players checked in, but can only see their usernames and information after checking in at the same court. The app checks the user’s location to make sure they are close enough before allowing them to check in. This helps protect players’ privacy by only showing who is there to other players who are also at the court.
- **Profile Screen**: Displays username, rank, ELO, win/loss record, streaks, and match history. Users will be able to view other player’s profiles, and also edit their own information.  Users can also block or report another player from that player’s profile.
- **King of Court Screen**: Displays active sessions, with the current winner(King of the Court) and their streak. Also, there is the queue you can enter to join in on the competition. The queue displays who is waiting in order, as well as the elo of each player. Player usernames, Elo, and other player info are only visible to users who are checked in at the same court.
- **Match Results Screen:** Allows players to report and confirm game results, submit appeals, and respond to appeals from other players. Displays updated Elo and win/loss record.
- **Challenge Screen:** Allows players to challenge others to games, choose a court, and accept or decline challenges.
- **Team/Matchmaking Screen (Future)**: Allows users to create teams, find players, and arrange games with other teams.

#### Reusable UI Components

- `components/`: Contains the reusable UI components like CourtMarker, CourtCard, PlayerCard, EloRankDisplay, and shared buttons. These will be used across screens to keep the interface as consistent as possible.
- **Navigation Bar:** This will be a bar at the bottom of the screen that will allow players to switch between the map, profile, and other main sections.
- **Court Markers:** Reusable map markers displaying court locations as well as live player counts. Selecting a map marker will take you to the court details screen of the selected court.
- **Court Card:** Displays basic court info, including court’s name, player count, and current activity. Selecting the card will open the court details screen.
- **Player Cards:** Displays basic player info, including username, Elo, and rank. Used in leaderboards, queues, and player lists
- **Elo/Rank Display:** Component that shows a player’s current rating/rank. Used across profiles, challenges and King of the Court.
- **Buttons:** Reusable components for certain actions like checking into courts, sending challenges, and joining queues.

#### Navigation and User Flow

- `navigation/`: Handles the bottom navigation bar and how users move between screens, like opening court details from the map or a profile from a player card.

Users are able to move between the main sections of the app using the navigation bar at the bottom of the screen. Selecting a court on the map will open its court details, where users can see court information and the number of players checked in. To see who is playing or join games, users must first check in. The app will check their location to prevent them from checking in if they are too far away. Once checked in, users can select players from the court’s player list to view their profiles and send challenges. After playing a game, players can use the Match Results screen to report and confirm the result.

### Feature data modules

- `services/`: Contains the feature data modules for things like the court activity, profiles, check-in, and challenges. The screens use these modules to communicate with the backend instead of directly accessing the database.
  - `mapService.ts`: Gets nearby courts and updates their activity on map.
  - `courtService.ts`: Receives updates to court activity and sessions.
  - `checkInService.ts`: Sends location and check-in requests to the backend and returns the status or error
  - `resultsService.ts`: Sends match results to Rating and gets the Elo preview or updated rating.
  - `kingOfTheCourtService.ts`: Sends session requests and gets the player’s queue position.
  - `teamService.ts` (future): Sends team format changes and returns the result or error.
  - `userAccountService.ts`: Handles requests for profiles, friendships, blocks, reports, challenges, and appeals.

#### Check-In and Privacy

The frontend sends the user’s location to the backend to check if they’re close enough to the court. If they are too far away or don’t allow location access, The app tells them why they can’t check in.

Users can still see court info and player counts, but the backend only sends player names and info from the court and queue to users checked in there. It’s not just hiding names on the screen. Once users check out, they can’t see who is there anymore.  Tokens are kept in Expo SecureStore.

## Backend

The main focus of the backend will be how to handle API calls from the front end, making queries to the database as necessary.

### Code Organization

We plan to organize the backend into the following folders:

### Court session

Planned split: courtInfo/ also manages queue order, the crown, the stream, and session start/end. Check-in handles attendance.  These folders group the Postgres functions in Supabase.

- `courtInfo/`: Contains logic updating the **courts** table, keeping track of each court’s occupancy, game type, and allowing users to join a court session
- `games/`: Contains logic for keeping track of ongoing games, as well as logging the results of previous games. Provides frontend with information regarding games in progress or in the matchmaking phase, and stores results.

### Rating

- `eloCalculator/`: Contains logic for calculating elo gain/loss for games as well as tracking a log of elo history, updating the **elo_history** table. Provides frontend with a player’s elo, and updates Elo on the server.

### Supabase Auth

- Supabase Auth SDK. Handles login and authentication. User Acc/ uses it for sign in.
- `userAcc/`: Contains logic to manage user’s account, including personal information, logins, friendships, challenge log, appeals, etc. Will handle user login and authentication via Superbase Auth. Provides frontend with a user’s profile information, and will restrict certain operations from frontend based on appeal/block statuses.

### Check-in

Planned Postfres functions in Supabase.

- `check_in`: checks location and sets 3 hour expiry
- `check_out`: Ends the user’s check in.
- `confirm_still_here`: Handles user’s “still here?” response.

#### Keeping activity accurate

A court status should not stay occupied when people leave without checking out.

- The server accepts a check-in only when the device is within 150 meters of the court.
- A check-in expires after 3 hours.
- Leaving the 150m radius around the court checks the player out within 5 minutes (Expo Go can’t track location in the background, so it runs the check when the user reopens the app).
- If location updates stop, the app asks the user if they are still at the court, and checks the player out if they do not answer.
- A "heading here" claim expires after 60 minutes.

## Database

Tables are described in Data storage (Section 7). This is the code for reading and writing. All units live in supabase/.

### Postgres and PostGIS

- `migrations/`: Create tables, indexes, and constraints in order; CI applies them from scratch.

- RLS policies: Decide which rows each caller sees: player names at a court only for players checked in there; blocks hide users from each other

- `nearby_courts(lat, lng, radius)`: Return nearby courts with status, active player count, and distance.

- Realtime on check_ins, sessions, session_players: Announce changes to the map and court screens subscribed to them.

#### Indexes and constraints.

| **Index / constraint** | **Serves** |
| --- | --- |
| **GiST on courts.location** | Nearby-courts search |
| **check_ins(court_id) where checked_out_at IS NULL** | Live player count per court |
| **UNIQUE check_ins(user_id) where checked_out_at IS NULL** | One open check-in per user |
| **UNIQUE on (LEAST, GREATEST) of the two friendships ids** | No duplicate friendship in reverse |
| **friendships(addressee_id)** | Incoming friend requests |
| **challenges(opponent_id, status)** | A user's pending challenges |
| **UNIQUE sessions(court_id) where ended_at IS NULL** | One active session per court |
| **UNIQUE elo_history(game_id, user_id) and UNIQUE elo_history(session_id, user_id)** | Elo applied at most once per game or session |
| **warnings(user_id, created_at)** | Counting a player's recent warnings |

#### Design decisions:

- Live counts are derived instead of stored. A court's count is a query over active check-ins, and expiry is checked at query time.
- Current Elo is on **profiles**; history is in **elo_history**. Rating writes both in one transaction. A 1v1 change points to its game; a KOC change points to its session.
- A challenge and a game are separate,  **games.challenge_id** is the link.
- KOC queue order is **queued_at**. A loser's **queued_at** resets to now, sending them to the back without renumbering anyone.
- **Game_players** with a **side** column covers 1v1, KOC, and team games. Elo stays per player.
- Team-game support is for later
- History is kept: Check-ins, games, and appeals are not deleted; a voided game keeps **‘status = voided’**.

### Court importer

- `import_courts` (weekly): Pull OSM and Seattle data, skip duplicates and manually edited courts, log the results.

# Coding Guideline

## TypeScript + React Native + Expo

- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
  - TypeScript-specific style guide prioritizing readability, maintainability, and consistency for multiple contributors. Pairs with Supabase-js backend service.
- [MarsBased React Native Style Guide](https://handbook.marsbased.com/guides/development/react-native-guidelines)
  - Covers mobile-specific development conventions for React Native and Expo; works well for writing consistently in React Native applications.
- [React Native ESLint config](https://github.com/intellicode/eslint-plugin-react-native)
  - Paired with Expo ESLint configuration, provides a framework-specific linter for improved correctness, especially for React Hooks.
- [SQL Style Guide](https://www.sqlstyle.guide/).
  - The migrations and confirm_result are SQL, so like the client, they need a published guide.

Thorough code reviews at the end of every week-long sprint will keep developers accountable for style, and linting will be done before any code is pushed to the repository.

# Documentation Plan

We plan to use TypeDoc to automatically generate documentation for our Typescript code. We will also maintain a GitHub README with instructions on how to set up and run the project, along with info about how the app is organized.

Additional Documentation we want to provide:

- **How to Play Basketball:** A link to an existing basketball basics guide for users that are not familiar. [https://www.breakthroughbasketball.com/basics/basics](https://www.breakthroughbasketball.com/basics/basics)
- **Creating a Profile:** Guide that runs through how to sign up, create a profile, and understand the Elo ranking system.
- **Court Check-in:** Guide that explains how to find nearby courts, see who is playing, and how to check-in and check-out.
- **Challenges and King of the Court:** Guide explaining how to challenge other players, join the King of the Court queue, how King of the Court works, and record game results.
- **Developer Documentation:** Info about the code structure, main components and how to set up the development environment.

We plan to work on and update these guides as we build out the different features of MOTION. That way we can document how everything works while we’re developing it instead of having to do it all at the end. We’ll also make additional updates to the documentation as features are updated or we get feedback from testing.
