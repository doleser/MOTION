import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {CourtDetailsScreen} from '../screens/main/CourtDetailsScreen';
import {MapScreen} from '../screens/main/MapScreen';
import type {MapStackParamList} from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

/**
 * The Map tab: the map, and Court Details on top of it. Living inside the
 * tab keeps the tab bar visible on Court Details (Figma: COURT / IMA).
 */
export function MapStack() {
  return (
    // Both screens draw their own top area (Figma design).
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="MapHome" component={MapScreen} />
      <Stack.Screen name="CourtDetails" component={CourtDetailsScreen} />
    </Stack.Navigator>
  );
}
