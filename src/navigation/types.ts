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
  Play: undefined;
  Profile: undefined;
};

/** Screens inside the Map tab. */
export type MapStackParamList = {
  MapHome: undefined;
  CourtDetails: {courtId: number};
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

// Tells React Navigation our root param list, so the `useNavigation()` hook
// is type-checked too, not just the `navigation` prop.
declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
