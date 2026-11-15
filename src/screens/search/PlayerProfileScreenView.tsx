import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ErrorMessage} from '../../components/ErrorMessage';
import {MotionButton} from '../../components/MotionButton';
import {PlayerIdentity} from '../../components/PlayerIdentity';
import {ProfileElo} from '../../components/ProfileElo';
import {RecentForm} from '../../components/RecentForm';
import {ScreenHeader} from '../../components/ScreenHeader';
import {StatPanel} from '../../components/StatPanel';
import {Toast} from '../../components/Toast';
import type {ChallengeStatus} from '../../services/challenges';
import type {PlayerProfile} from '../../services/players';
import {colors, sizes, spacing, typography} from '../../theme';
import {formatStreak, formatWinRate} from '../main/winRate';

/** What the screen is showing. */
export type PlayerProfileState =
  | {kind: 'loading'}
  | {kind: 'error'; message: string}
  | {kind: 'loaded'; profile: PlayerProfile; status: ChallengeStatus};

/** The greyed-out button's label when they can't be challenged. */
const BLOCKED_LABELS: Record<Exclude<ChallengeStatus, 'can_challenge'>, string> = {
  not_accepting: 'NOT ACCEPTING CHALLENGES',
  pending: 'CHALLENGE PENDING',
  declined_recently: 'YOU CAN CHALLENGE THEM AGAIN LATER',
};

interface PlayerProfileScreenViewProps {
  state: PlayerProfileState;
  onBack: () => void;
  onRetry: () => void;
  onChallenge: () => void;
  /** True right after a challenge was sent, to show "Challenge sent". */
  showSentToast: boolean;
  onHideSentToast: () => void;
}

/**
 * Another player's profile, opened from search, with a Challenge button.
 * Figma: "PROFILE / Public player" (node 2514:2628). Left out: the rank
 * after the username (not sent by the backend yet) and the BACK TO SEARCH
 * button (the back arrow does the same).
 */
export function PlayerProfileScreenView({
  state,
  onBack,
  onRetry,
  onChallenge,
  showSentToast,
  onHideSentToast,
}: PlayerProfileScreenViewProps) {
  return (
    <View style={styles.root}>
      {/* Bottom edge left out: the tab bar already sits above the home bar. */}
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader title="PLAYER PROFILE" onBack={onBack} />
        <View style={styles.divider} />
        <Body state={state} onRetry={onRetry} onChallenge={onChallenge} />
      </SafeAreaView>
      <Toast message="Challenge sent" visible={showSentToast} onHide={onHideSentToast} />
    </View>
  );
}

interface BodyProps {
  state: PlayerProfileState;
  onRetry: () => void;
  onChallenge: () => void;
}

function Body({state, onRetry, onChallenge}: BodyProps) {
  if (state.kind === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Loading profile" color={colors.yellow} />
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={styles.errorBox}>
        <ErrorMessage message={state.message} />
        <MotionButton label="Try again" variant="secondary" onPress={onRetry} />
      </View>
    );
  }

  const {profile, status} = state;
  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <PlayerIdentity realName={profile.realName} username={profile.username} />
        <ProfileElo elo={profile.elo} />
        <StatPanel
          stats={[
            {value: `${profile.record.wins}-${profile.record.losses}`, label: 'WIN / LOSS'},
            {value: formatWinRate(profile.record), label: 'WIN RATE'},
            {value: formatStreak(profile.record.streak), label: 'STREAK'},
          ]}
        />
        <RecentForm results={profile.record.recentResults} />
        <Text style={styles.privacy}>PUBLIC PROFILE · CURRENT LOCATION IS PRIVATE</Text>
      </ScrollView>

      {/* Pinned above the tab bar (Figma); the profile scrolls behind it. */}
      <View style={styles.footer}>
        {status === 'can_challenge' ? (
          <MotionButton label="CHALLENGE TO 1V1" onPress={onChallenge} />
        ) : (
          // Same spot, greyed out, with the reason as its label.
          <MotionButton
            label={BLOCKED_LABELS[status]}
            variant="secondary"
            disabled
            onPress={onChallenge}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  divider: {
    height: sizes.border,
    marginHorizontal: spacing.screen,
    backgroundColor: colors.line,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    padding: spacing.screen,
    gap: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  // Same as the Profile tab: 12 below the header, 20 side margins, 24
  // between sections, capped and centered on iPad.
  content: {
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.screen,
    gap: spacing.xl,
  },
  privacy: {
    ...typography.meta,
    color: colors.muted,
  },
  // Figma: 16 above the button, 24 below it (above the tab bar).
  footer: {
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
