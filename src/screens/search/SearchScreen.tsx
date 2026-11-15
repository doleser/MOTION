import {Pressable, StyleSheet, Text, View} from 'react-native';

import {MotionButton} from '../../components/MotionButton';
import type {SearchScreenProps} from '../../navigation/types';
import {colors, opacity, sizes, typography} from '../../theme';
import {PlaceholderLayout} from './PlaceholderLayout';

import InboxIcon from '../../../assets/icons/inbox.svg';

// TODO: replace with a real search (and real user IDs) once the service exists.
const FAKE_RESULT = {userId: 'fake-player-1', username: 'sample_player'};
// TODO: load the number of pending challenges the user has received.
const FAKE_PENDING_COUNT = 2;

/** PLACEHOLDER: player search. The inbox icon opens the challenges inbox. */
export function SearchScreen({navigation}: SearchScreenProps<'SearchHome'>) {
  const inboxLabel =
    FAKE_PENDING_COUNT > 0
      ? `Challenges inbox, ${FAKE_PENDING_COUNT} pending`
      : 'Challenges inbox';

  const inboxButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={inboxLabel}
      onPress={() => navigation.navigate('ChallengesInbox')}
      style={({pressed}) => [styles.inbox, pressed && styles.pressed]}>
      {/* The SVG file sets its own 24 x 24 size. */}
      <InboxIcon />
      {FAKE_PENDING_COUNT > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{FAKE_PENDING_COUNT}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <PlaceholderLayout
      title="SEARCH"
      headerRight={inboxButton}
      note="Search for players by username. Results will show here.">
      <MotionButton
        label={`@${FAKE_RESULT.username} (fake result)`}
        variant="secondary"
        onPress={() => navigation.navigate('PlayerProfile', {userId: FAKE_RESULT.userId})}
      />
    </PlaceholderLayout>
  );
}

const BADGE_SIZE = 16;

const styles = StyleSheet.create({
  inbox: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: opacity.pressed,
  },
  // Not in Figma yet: a small yellow circle on the icon's top-right corner.
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    paddingHorizontal: 4,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.yellow,
  },
  badgeText: {
    ...typography.meta,
    lineHeight: BADGE_SIZE,
    color: colors.bg,
  },
});
