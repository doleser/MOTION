import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {colors} from '../components/theme';
import {LoginScreen} from '../screens/auth/LoginScreen';
import {SignUpScreen} from '../screens/auth/SignUpScreen';
import {ChooseHandleScreen} from '../screens/onboarding/ChooseHandleScreen';
import {HomeCourtScreen} from '../screens/onboarding/HomeCourtScreen';
import {OnboardingDraftProvider} from '../screens/onboarding/OnboardingDraftContext';
import {PermissionsScreen} from '../screens/onboarding/PermissionsScreen';
import {ProfileDetailsScreen} from '../screens/onboarding/ProfileDetailsScreen';
import {SelfAssessmentScreen} from '../screens/onboarding/SelfAssessmentScreen';
import {StartingEloScreen} from '../screens/onboarding/StartingEloScreen';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Everything a signed-out user can see: Login (the first screen) and the
 * whole sign-up flow (SignUp through StartingElo). Back works on every
 * sign-up step.
 */
export function AuthStack() {
  return (
    // The sign-up draft lives as long as the user is signed out.
    <OnboardingDraftProvider>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{headerTintColor: colors.primary}}>
        {/* Login and SignUp draw their own top area (Figma design), so the
            default header is hidden on both. */}
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
          name="SelfAssessment"
          component={SelfAssessmentScreen}
          options={{title: 'Skill level'}}
        />
        <Stack.Screen
          name="Permissions"
          component={PermissionsScreen}
          options={{title: 'Permissions'}}
        />
        <Stack.Screen
          name="HomeCourt"
          component={HomeCourtScreen}
          options={{title: 'Home court'}}
        />
        <Stack.Screen
          name="StartingElo"
          component={StartingEloScreen}
          // The account is already created: no going back into sign-up.
          options={{title: 'Starting Elo', headerBackVisible: false, gestureEnabled: false}}
        />
      </Stack.Navigator>
    </OnboardingDraftProvider>
  );
}
