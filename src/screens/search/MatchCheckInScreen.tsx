import {Text} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';

/** TEMPORARY stand-in so the route exists; Step 5 builds the real screen. */
export function MatchCheckInScreen({route}: SearchScreenProps<'MatchCheckIn'>) {
  return <Text>Check-in for challenge {route.params.challengeId}</Text>;
}
