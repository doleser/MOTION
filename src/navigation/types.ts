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
 * The root shows exactly one of these two groups, depending on whether the
 * user is signed in (see RootNavigator).
 */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// ---------- Auth (signed out): login and the whole sign-up flow ----------

/** Sign-up screens appear in this order, from SignUp to StartingElo. */
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  /** `errorMessage` is set when HomeCourt sends the user back (e.g. email taken). */
  SignUp: {errorMessage?: string} | undefined;
  /** `errorMessage` is set when HomeCourt sends the user back (username taken). */
  ChooseHandle: {errorMessage?: string} | undefined;
  ProfileDetails: undefined;
  SelfAssessment: undefined;
  Permissions: undefined;
  HomeCourt: undefined;
  /** Shown after createAccount succeeds, with the Elo the server returned. */
  StartingElo: {elo: number};
};

// ---------- Main (signed in, onboarded) ----------

export type MainTabParamList = {
  Map: undefined;
  Play: undefined;
  Profile: undefined;
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

// Tells React Navigation our root param list, so the `useNavigation()` hook
// is type-checked too, not just the `navigation` prop.
declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
