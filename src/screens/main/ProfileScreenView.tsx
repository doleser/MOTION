import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {MotionButton} from '../../components/MotionButton';
import {PlayerIdentity} from '../../components/PlayerIdentity';
import {type GameResult, RecentForm} from '../../components/RecentForm';
import {ScreenHeader} from '../../components/ScreenHeader';
import {type Stat, StatPanel} from '../../components/StatPanel';
import {colors, sizes, spacing, typography} from '../../theme';

interface ProfileScreenViewProps {
  username: string;
  /** Play-style tags and height, e.g. "Shooter / Playmaker · 6′ 2″". */
  details?: string;
  elo: number;
  stats: Stat[];
  /** Most recent games, oldest first. */
  recentResults: GameResult[];
  error: string | null;
  isSigningOut: boolean;
  onSignOut: () => void;
}

/**
 * Profile tab layout: the signed-in player's own profile.
 * Figma: "PROFILE / You" (node 6:136).
 */
export function ProfileScreenView({
  username,
  details,
  elo,
  stats,
  recentResults,
  error,
  isSigningOut,
  onSignOut,
}: ProfileScreenViewProps) {
  return (
    // Bottom edge left out: the tab bar already sits above the home bar.
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* A tab, so there's nothing to go back to: no back arrow. */}
      <ScreenHeader title="YOUR PROFILE" />
      <View style={styles.divider} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <PlayerIdentity name={username} details={details} />

        <View style={styles.elo}>
          <Text style={styles.eloLabel}>1V1 ELO · PROVISIONAL</Text>
          <Text
            // The number alone would be read as just "800".
            accessibilityLabel={`Elo ${elo}, provisional`}
            style={styles.eloValue}>
            {elo}
          </Text>
        </View>

        <StatPanel stats={stats} />

        <RecentForm results={recentResults} />

        <View style={styles.actions}>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <MotionButton
            label="SIGN OUT"
            variant="secondary"
            loading={isSigningOut}
            onPress={onSignOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  divider: {
    height: sizes.border,
    marginHorizontal: spacing.screen,
    backgroundColor: colors.raised,
  },
  scroll: {
    flex: 1,
  },
  content: {
    // Full width on phones; capped and centered on iPad (same as AuthLayout).
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    // Figma: 12 below the header, 20 side margins, 24 between sections.
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.screen,
    gap: spacing.xl,
  },
  elo: {
    gap: spacing.xs,
  },
  eloLabel: {
    ...typography.label,
    color: colors.muted,
  },
  eloValue: {
    ...typography.elo,
    color: colors.yellow,
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    ...typography.body,
    color: colors.error,
  },
});
