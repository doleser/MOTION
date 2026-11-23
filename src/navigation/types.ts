/**
 * Route types for every navigator in the app.
 *
 * Each "param list" maps a screen name to the params that screen needs.
 * `undefined` means the screen takes no params.
 *
 * These are `type` aliases rather than interfaces on purpose: React Navigation
 * requires param lists to be plain object types, and interfaces don't satisfy
 * its constraint.
 */
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

// ---------- Root ----------

/**
 * The root shows exactly one of these, depending on whether the user is
 * signed in and has a username (see RootNavigator).
 */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  /** Signed in without a username. Shouldn't happen; see FinishSetupScreen. */
  FinishSetup: undefined;
};

// ---------- Auth (signed out): login and the whole sign-up flow ----------

/** Sign-up screens appear in this order, from SignUp to StartingElo. */
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  /** `errorMessage` is set when StartingElo sends the user back (e.g. email taken). */
  SignUp: {errorMessage?: string} | undefined;
  /** `errorMessage` is set when StartingElo sends the user back (username taken). */
  ChooseHandle: {errorMessage?: string} | undefined;
  ProfileDetails: undefined;
  HomeCourt: undefined;
  Experience: undefined;
  /** Previews the starting Elo from the draft; "Create account" ends sign-up. */
  StartingElo: undefined;
};

// ---------- Main (signed in, with a username) ----------

export type MainTabParamList = {
  /** The Map tab is a stack, so Court Details opens with the tab bar still showing. */
  Map: NavigatorScreenParams<MapStackParamList> | undefined;
  /** Also a stack: player search and 1v1 challenges. */
  Search: NavigatorScreenParams<SearchStackParamList> | undefined;
  Profile: undefined;
};

/** Screens inside the Map tab. */
export type MapStackParamList = {
  MapHome: undefined;
  CourtDetails: {courtId: number};
  /** Opens after a verified check-in at courtId. Placeholder for now. */
  CheckedInCourt: {courtId: number};
};

/**
 * Screens inside the Search tab. User IDs are Supabase UUIDs (strings);
 * challenge IDs are numbers, like the other tables' IDs.
 */
export type SearchStackParamList = {
  /** Player search, with the challenges inbox icon in the top corner. */
  SearchHome: undefined;
  /**
   * Another player's profile, opened from a search result. The challenge
   * sheet sets `challengeSentAt` (a timestamp) when it closes after sending,
   * which shows the "Challenge sent" message.
   */
  PlayerProfile: {userId: string; challengeSentAt?: number};
  /** The challenge form for a 1v1 against `opponentId`, as a sheet over the profile. */
  CreateChallenge: {opponentId: string};
  /** Received, sent, and upcoming challenges. */
  ChallengesInbox: undefined;
  /** One challenge, as a sheet over the inbox: Accept/Decline, Cancel, or Check In. */
  ChallengeDetails: {challengeId: number};
  /** Check in at the court for a confirmed 1v1 match. */
  MatchCheckIn: {challengeId: number};
  /** A ranked 1v1's result: report who won, wait, confirm or dispute, and the outcome. */
  MatchResult: {challengeId: number};
};

// ---------- Screen prop helpers ----------
// Screens use these to type their `navigation` and `route` props, e.g.
//   function LoginScreen({navigation}: AuthScreenProps<'Login'>) { ... }

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

/**
 * Tab screens live inside the root stack, so their `navigation` prop knows
 * about both the tabs and the root routes.
 */
export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootScreenProps<keyof RootStackParamList>
  >;

/**
 * Map tab screens live inside the tabs, so their `navigation` prop knows
 * about the Map stack, the tabs, and the root routes.
 */
export type MapScreenProps<T extends keyof MapStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<MapStackParamList, T>,
    MainTabScreenProps<'Map'>
  >;

/** Same as MapScreenProps, for the Search tab's stack. */
export type SearchScreenProps<T extends keyof SearchStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<SearchStackParamList, T>,
    MainTabScreenProps<'Search'>
  >;

// Tells React Navigation our root param list, so the `useNavigation()` hook
// is type-checked too, not just the `navigation` prop.
declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
