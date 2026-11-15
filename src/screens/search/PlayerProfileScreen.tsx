import {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';

import {MotionButton} from '../../components/MotionButton';
import {Toast} from '../../components/Toast';
import type {SearchScreenProps} from '../../navigation/types';
import {PlaceholderLayout} from './PlaceholderLayout';

/** PLACEHOLDER: another player's profile, with a Challenge button. */
export function PlayerProfileScreen({navigation, route}: SearchScreenProps<'PlayerProfile'>) {
  const {userId, challengeSentAt} = route.params;
  // The challenge sheet sets `challengeSentAt` when it closes after sending.
  // The message shows while it's set; clearing it hides the message.
  const hideSentToast = useCallback(
    () => navigation.setParams({challengeSentAt: undefined}),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <PlaceholderLayout
        title="PLAYER PROFILE"
        onBack={() => navigation.goBack()}
        note={`This player's Elo, record, and recent games will show here. (userId: ${userId})`}>
        <MotionButton
          label="Challenge"
          onPress={() => navigation.navigate('CreateChallenge', {opponentId: userId})}
        />
      </PlaceholderLayout>
      <Toast message="Challenge sent" visible={challengeSentAt !== undefined} onHide={hideSentToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
