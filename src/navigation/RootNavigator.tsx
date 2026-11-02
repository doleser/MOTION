import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {FullScreenSpinner} from '../components/FullScreenSpinner';
import {FinishSetupScreen} from '../screens/auth/FinishSetupScreen';
import {useAuth} from '../services/AuthContext';
import {AuthStack} from './AuthStack';
import {MainTabs} from './MainTabs';
import type {RootStackParamList} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * Shows exactly one group at a time:
 *   signed out               -> AuthStack (Welcome, Login, and sign-up)
 *   signed in, with username -> MainTabs
 *   signed in, no username   -> FinishSetup
 *
 * Accounts are created together with their profile, so the last case
 * shouldn't happen; FinishSetup is a safe landing spot if it ever does.
 *
 * Exception: while sign-up is finishing (`isFinishingSignUp`), AuthStack
 * stays up even though the user is now signed in, so StartingElo can ask
 * for location permission before the map appears.
 * Only one group exists at once, so there's no "Back" from the tabs into
 * the sign-up screens.
 */
export function RootNavigator() {
  const {isLoading, session, profile, isFinishingSignUp} = useAuth();

  // Skipped while sign-up finishes: the spinner would replace AuthStack (and
  // StartingElo with it) while the new profile loads.
  if (isLoading && !isFinishingSignUp) {
    return <FullScreenSpinner />;
  }

  return (
    <RootStack.Navigator screenOptions={{headerShown: false}}>
      {!session || isFinishingSignUp ? (
        <RootStack.Screen name="Auth" component={AuthStack} />
      ) : profile?.username ? (
        <RootStack.Screen name="Main" component={MainTabs} />
      ) : (
        <RootStack.Screen name="FinishSetup" component={FinishSetupScreen} />
      )}
    </RootStack.Navigator>
  );
}
