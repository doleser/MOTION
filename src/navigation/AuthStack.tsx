import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {colors} from '../components/theme';
import {LoginScreen} from '../screens/auth/LoginScreen';
import {SignUpScreen} from '../screens/auth/SignUpScreen';
import {WelcomeScreen} from '../screens/auth/WelcomeScreen';
import {ChooseHandleScreen} from '../screens/onboarding/ChooseHandleScreen';
import {ExperienceScreen} from '../screens/onboarding/ExperienceScreen';
import {OnboardingDraftProvider} from '../screens/onboarding/OnboardingDraftContext';
import {ProfileDetailsScreen} from '../screens/onboarding/ProfileDetailsScreen';
import {StartingEloScreen} from '../screens/onboarding/StartingEloScreen';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Everything a signed-out user can see: Welcome (the first screen), Login,
 * and the whole sign-up flow: SignUp -> ChooseHandle -> ProfileDetails ->
 * Experience -> StartingElo. Back works on every step; from Login or SignUp
 * it returns to Welcome.
 */
export function AuthStack() {
  return (
    // The sign-up draft lives as long as the user is signed out.
    <OnboardingDraftProvider>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{headerTintColor: colors.primary}}>
        {/* Welcome, Login, and SignUp draw their own top area (Figma design),
            so the default header is hidden on all three. */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{headerShown: false}} />
        <Stack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} />

        {/* Sign-up flow, in order */}
        <Stack.Screen name="SignUp" component={SignUpScreen} options={{headerShown: false}} />
        <Stack.Screen
          name="ChooseHandle"
          component={ChooseHandleScreen}
          options={{title: 'Username'}}
        />
        <Stack.Screen
          name="ProfileDetails"
          component={ProfileDetailsScreen}
          options={{title: 'Details'}}
        />
        <Stack.Screen
          name="Experience"
          component={ExperienceScreen}
          options={{title: 'Experience'}}
        />
        {/* Back still works here: nothing is saved until "Create account". */}
        <Stack.Screen
          name="StartingElo"
          component={StartingEloScreen}
          options={{title: 'Starting Elo'}}
        />
      </Stack.Navigator>
    </OnboardingDraftProvider>
  );
}
