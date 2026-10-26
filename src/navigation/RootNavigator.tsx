import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {FullScreenSpinner} from '../components/FullScreenSpinner';
import {useAuth} from '../services/AuthContext';
import {AuthStack} from './AuthStack';
import {MainTabs} from './MainTabs';
import type {RootStackParamList} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * Shows exactly one group at a time:
 *   signed out -> AuthStack (Welcome, Login, and the sign-up flow)
 *   signed in  -> MainTabs
 *
 * Accounts are created together with their profile, so every signed-in user
 * already has a username; there's no "half-onboarded" state to handle.
 * Only one group exists at once, so there's no "Back" from the tabs into
 * the sign-up screens.
 */
export function RootNavigator() {
  const {isLoading, session} = useAuth();

  if (isLoading) {
    return <FullScreenSpinner />;
  }

  return (
    <RootStack.Navigator screenOptions={{headerShown: false}}>
      {session ? (
        <RootStack.Screen name="Main" component={MainTabs} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthStack} />
      )}
    </RootStack.Navigator>
  );
}
