import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useLayoutEffect, useState} from 'react';
import {Alert} from 'react-native';

import type {MainTabScreenProps} from '../../navigation/types';
import {useAuth} from '../../services/AuthContext';
import {signOut} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';
import {getPlayerRecord, type PlayerRecord} from '../../services/records';
import {ProfileScreenView} from './ProfileScreenView';
import {formatWinRate} from './winRate';

/** Shown in every stat box until the record has loaded. */
const NOT_LOADED = '—';

/**
 * The Profile tab: the signed-in player's own profile and Sign out.
 * ProfileScreenView draws the screen.
 */
export function ProfileScreen({navigation}: MainTabScreenProps<'Profile'>) {
  const {profile} = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  // null until the first load finishes (or if it failed).
  const [record, setRecord] = useState<PlayerRecord | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const userId = profile?.userId;

  // Reload the record every time the tab opens, so a game that was just
  // confirmed shows up. A reload keeps the old numbers on screen until the
  // new ones arrive, so the boxes don't flash back to dashes.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      // Ignore an answer that arrives after the user has left the tab.
      let isCurrent = true;
      getPlayerRecord(userId)
        .then((loaded) => {
          if (!isCurrent) return;
          setRecord(loaded);
          setRecordError(null);
        })
        .catch((e: unknown) => {
          if (!isCurrent) return;
          console.warn('Could not load record', e);
          setRecordError("Couldn't load your record.");
        });
      return () => {
        isCurrent = false;
      };
    }, [userId]),
  );

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
          {value: record ? `${record.wins}-${record.losses}` : NOT_LOADED, label: 'WIN / LOSS'},
          {value: record ? formatWinRate(record) : NOT_LOADED, label: 'WIN RATE'},
          {value: record ? formatStreak(record.streak) : NOT_LOADED, label: 'STREAK'},
        ]}
        recentResults={record?.recentResults ?? []}
        // A sign-out problem matters more, so it wins if both happen.
        error={error ?? recordError}
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
