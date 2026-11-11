import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useLayoutEffect, useState} from 'react';
import {Alert} from 'react-native';

import type {GameResult} from '../../components/RecentForm';
import type {MainTabScreenProps} from '../../navigation/types';
import {useAuth} from '../../services/AuthContext';
import {signOut} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';
import {ProfileScreenView} from './ProfileScreenView';
import {formatWinRate, type WinLoss} from './winRate';

interface PlayerRecord extends WinLoss {
  /** The current run of wins or losses, or null with no games yet. */
  streak: {result: GameResult; count: number} | null;
  /** Results of the most recent games, oldest first (up to 5 are shown). */
  recentResults: GameResult[];
}

/**
 * FAKE record, until games are played and saved.
 * TODO: replace with real data from the backend (same shape).
 */
const FAKE_RECORD: PlayerRecord = {
  wins: 0,
  losses: 0,
  streak: null,
  recentResults: [],
};

/**
 * The Profile tab: the signed-in player's own profile and Sign out.
 * ProfileScreenView draws the screen.
 */
export function ProfileScreen({navigation}: MainTabScreenProps<'Profile'>) {
  const {profile} = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // The tab bar adds a plain white header to every tab. This screen draws
  // its own (Figma), so hide that one here only.
  useLayoutEffect(() => {
    navigation.setOptions({headerShown: false});
  }, [navigation]);

  // Tabs stay mounted when hidden, so only set the status bar while showing.
  const isFocused = useIsFocused();

  function confirmSignOut() {
    Alert.alert('Sign out?', "You'll need your email and password to sign back in.", [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Sign out', style: 'destructive', onPress: () => void handleSignOut()},
    ]);
  }

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      // The root switches back to the Welcome screen on its own.
    } catch (e) {
      setError(getErrorMessage(e));
      setIsSigningOut(false);
    }
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <ProfileScreenView
        realName={profile?.realName}
        username={profile?.username ?? ''}
        elo={profile?.elo ?? 0}
        stats={[
          {value: `${FAKE_RECORD.wins}-${FAKE_RECORD.losses}`, label: 'WIN / LOSS'},
          {value: formatWinRate(FAKE_RECORD), label: 'WIN RATE'},
          {value: formatStreak(FAKE_RECORD.streak), label: 'STREAK'},
        ]}
        recentResults={FAKE_RECORD.recentResults}
        error={error}
        isSigningOut={isSigningOut}
        onSignOut={confirmSignOut}
      />
    </>
  );
}

/** "W3", or "—" with no games yet. */
function formatStreak(streak: PlayerRecord['streak']): string {
  return streak && streak.count > 0 ? `${streak.result}${streak.count}` : '—';
}
