import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {PlayScreen} from '../screens/main/PlayScreen';
import {ProfileScreen} from '../screens/main/ProfileScreen';
import {MapStack} from './MapStack';
import {MotionTabBar} from './MotionTabBar';
import type {MainTabParamList} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Signed in and onboarded: the bottom tab bar. */
export function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <MotionTabBar {...props} />}>
      {/* The Map stack draws its own top area (Figma design). */}
      <Tab.Screen name="Map" component={MapStack} options={{headerShown: false}} />
      {/* TODO: hide these headers once Play and Profile get their Figma designs. */}
      <Tab.Screen name="Play" component={PlayScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
