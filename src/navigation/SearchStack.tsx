import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {ChallengeDetailsScreen} from '../screens/search/ChallengeDetailsScreen';
import {ChallengesInboxScreen} from '../screens/search/ChallengesInboxScreen';
import {MatchCheckInScreen} from '../screens/search/MatchCheckInScreen';
import {MatchResultScreen} from '../screens/search/MatchResultScreen';
import {CreateChallengeScreen} from '../screens/search/CreateChallengeScreen';
import {PlayerProfileScreen} from '../screens/search/PlayerProfileScreen';
import {SearchScreen} from '../screens/search/SearchScreen';
import {colors} from '../theme';
import type {SearchStackParamList} from './types';
 

const Stack = createNativeStackNavigator<SearchStackParamList>();

/**
 * The Search tab: player search, other players' profiles, and challenges.
 * Living inside the tab keeps the tab bar visible on every screen, like the
 * Map stack.
 */
export function SearchStack() {
  return (
    // Every screen draws its own top bar with ScreenHeader.
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="SearchHome" component={SearchScreen} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
      {/* A sheet that slides up over the player's profile, sized to its content. */}
      <Stack.Screen
        name="CreateChallenge"
        component={CreateChallengeScreen}
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          contentStyle: {backgroundColor: colors.bg},
        }}
      />
      <Stack.Screen name="ChallengesInbox" component={ChallengesInboxScreen} />
      {/* A sheet over the inbox, like the challenge sheet. */}
      <Stack.Screen
        name="ChallengeDetails"
        component={ChallengeDetailsScreen}
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          contentStyle: {backgroundColor: colors.bg},
        }}
      />
      <Stack.Screen name="MatchCheckIn" component={MatchCheckInScreen} />
      <Stack.Screen name="MatchResult" component={MatchResultScreen} />
    </Stack.Navigator>
  );
}
