import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {colors} from '../components/theme';
import {MapScreen} from '../screens/main/MapScreen';
import {PlayScreen} from '../screens/main/PlayScreen';
import {ProfileScreen} from '../screens/main/ProfileScreen';
import type {MainTabParamList} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Signed in and onboarded: the bottom tab bar. */
export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        // TODO: add tab icons once the team picks an icon set.
        tabBarIcon: () => null,
        tabBarLabelStyle: {fontSize: 14, fontWeight: '600'},
      }}>
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Play" component={PlayScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
