import {ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ChallengeRow} from '../../components/ChallengeRow';
import {ErrorMessage} from '../../components/ErrorMessage';
import {MotionButton} from '../../components/MotionButton';
import {ScreenHeader} from '../../components/ScreenHeader';
import {getDisplayStatus, isCheckInOpen, type InboxSections} from '../../services/challengeStatus';
import type {Challenge} from '../../services/challenges';
import {colors, sizes, spacing, typography} from '../../theme';
import {formatMatchTime} from './matchTime';

/** What the screen is showing. */
export type InboxState =
  | {kind: 'loading'}
  | {kind: 'error'; message: string}
  | {kind: 'loaded'; sections: InboxSections<Challenge>; now: Date};

interface ChallengesInboxScreenViewProps {
  state: InboxState;
  isRefreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onBack: () => void;
  onOpenChallenge: (challengeId: number) => void;
}

/** Section headings, in display order. */
const SECTIONS: {key: keyof InboxSections<Challenge>; title: string}[] = [
  {key: 'needsAnswer', title: 'NEEDS YOUR ANSWER'},
  {key: 'upcoming', title: 'UPCOMING'},
  {key: 'waiting', title: 'WAITING'},
  {key: 'recent', title: 'RECENT'},
];

/**
 * The challenges inbox, opened from the inbox icon on Search. Not in Figma:
 * built to match Search and Player Profile.
 */
export function ChallengesInboxScreenView({
  state,
  isRefreshing,
  onRefresh,
  onRetry,
  onBack,
  onOpenChallenge,
}: ChallengesInboxScreenViewProps) {
  return (
    // Bottom edge left out: the tab bar already sits above the home bar.
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="CHALLENGES" onBack={onBack} />
      <View style={styles.divider} />
      {state.kind === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading challenges" color={colors.yellow} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.yellow}
              colors={[colors.yellow]}
              progressBackgroundColor={colors.panel}
            />
          }>
          {state.kind === 'error' ? (
            <View style={styles.errorBox}>
              <ErrorMessage message={state.message} />
              <MotionButton label="Try again" variant="secondary" onPress={onRetry} />
            </View>
          ) : (
            <Sections sections={state.sections} now={state.now} onOpenChallenge={onOpenChallenge} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

interface SectionsProps {
  sections: InboxSections<Challenge>;
  now: Date;
  onOpenChallenge: (challengeId: number) => void;
}

function Sections({sections, now, onOpenChallenge}: SectionsProps) {
  const isEmpty = SECTIONS.every(({key}) => sections[key].length === 0);
  if (isEmpty) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No challenges yet.</Text>
        <Text style={styles.emptyBody}>Find a player in Search to challenge them to a 1v1.</Text>
      </View>
    );
  }

  return (
    <>
      {SECTIONS.map(({key, title}) =>
        // Each section is hidden when empty.
        sections[key].length === 0 ? null : (
          <View key={key} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {title}
            </Text>
            {sections[key].map((challenge) => {
              const {label, highlight} = getRowStatus(challenge, now);
              return (
                <ChallengeRow
                  key={challenge.id}
                  direction={challenge.direction}
                  realName={challenge.opponent.realName}
                  username={challenge.opponent.username}
                  courtName={challenge.court.name}
                  when={formatMatchTime(challenge.startsAt)}
                  statusLabel={label}
                  highlightStatus={highlight}
                  ranked={challenge.ranked}
                  faded={key === 'recent'}
                  onPress={() => onOpenChallenge(challenge.id)}
                />
              );
            })}
          </View>
        ),
      )}
    </>
  );
}

/** The label on the right of a row, and whether it's yellow. */
function getRowStatus(challenge: Challenge, now: Date): {label: string; highlight: boolean} {
  const status = getDisplayStatus(challenge, now);
  if (status === 'pending') {
    return challenge.direction === 'incoming'
      ? {label: 'NEW', highlight: true}
      : {label: 'PENDING', highlight: false};
  }
  if (status === 'confirmed') {
    return {label: isCheckInOpen(challenge, now) ? 'CHECK-IN OPEN' : 'CONFIRMED', highlight: true};
  }
  // Declined, cancelled, expired, ended: grey.
  return {label: status.toUpperCase(), highlight: false};
}

const styles = StyleSheet.create({
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
  scroll: {
    flex: 1,
  },
  // 12 below the header, 20 side margins, 24 between sections (like Profile).
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.screen,
    gap: spacing.xl,
  },
  errorBox: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.muted,
  },
  empty: {
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.ui,
    color: colors.text,
  },
  emptyBody: {
    ...typography.body,
    color: colors.muted,
  },
});
