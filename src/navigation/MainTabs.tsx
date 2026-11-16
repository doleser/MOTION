import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {ProfileScreen} from '../screens/main/ProfileScreen';
import {MapStack} from './MapStack';
import {MotionTabBar} from './MotionTabBar';
import {SearchStack} from './SearchStack';
import type {MainTabParamList} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Signed in and onboarded: the bottom tab bar. */
export function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <MotionTabBar {...props} />}>
      {/* The Map and Search stacks draw their own top areas. */}
      <Tab.Screen name="Map" component={MapStack} options={{headerShown: false}} />
      <Tab.Screen name="Search" component={SearchStack} options={{headerShown: false}} />
      {/* TODO: hide this header once Profile gets its Figma design. */}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
