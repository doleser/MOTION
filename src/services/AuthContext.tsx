/**
 * App-wide auth state: who is signed in and their profile.
 *
 * Wrap the app in <AuthProvider>, then read the state anywhere with
 * `useAuth()`. The root navigator uses it to pick Auth, Main, or FinishSetup.
 *
 * This file talks only to the auth and profile services, never to Supabase
 * directly.
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {getSession, onAuthStateChange, type Session} from './auth';
import {getMyProfile, type Profile} from './profile';

export interface AuthState {
  /** True until we know who is signed in and have their profile. */
  isLoading: boolean;
  /** null when signed out. */
  session: Session | null;
  /** The signed-in user's profile; null when signed out or still loading. */
  profile: Profile | null;
  /** Re-fetches the profile, e.g. after onboarding saves it. */
  refreshProfile: () => Promise<void>;
  /**
   * True while the last sign-up step is finishing. The root keeps showing
   * the sign-up screens, even once signed in, until this goes back to false.
   */
  isFinishingSignUp: boolean;
  /**
   * StartingElo turns this on before creating the account, and off once the
   * location question is answered (or creating the account failed).
   */
  setFinishingSignUp: (finishing: boolean) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
  const [isStarting, setIsStarting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFinishingSignUp, setFinishingSignUp] = useState(false);

  // The user we're currently showing. A profile request that finishes after
  // that user signed out is ignored, so we never show someone else's profile.
  const currentUserId = useRef<string | null>(null);
  // Counts profile requests. Only the newest one is used, so a slow, older
  // request (e.g. from before sign-up saved the username) can't win.
  const latestLoad = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    const loadNumber = ++latestLoad.current;
    try {
      const loaded = await getMyProfile();
      if (currentUserId.current === userId && loadNumber === latestLoad.current) {
        setProfile(loaded);
      }
    } catch (error) {
      // TODO: show an error + retry screen once the real backend can fail.
      console.warn('Could not load profile', error);
    }
  }, []);

  const handleSession = useCallback(
    async (next: Session | null) => {
      currentUserId.current = next?.user.id ?? null;
      setSession(next);
      setProfile(null);
      if (next) {
        await loadProfile(next.user.id);
      }
    },
    [loadProfile],
  );

  useEffect(() => {
    // Follow future sign-ins and sign-outs...
    const unsubscribe = onAuthStateChange((next) => {
      void handleSession(next);
    });
    // ...and find out who (if anyone) is signed in right now.
    getSession()
      .then(handleSession)
      .finally(() => setIsStarting(false));
    return unsubscribe;
  }, [handleSession]);

  const refreshProfile = useCallback(async () => {
    if (currentUserId.current) {
      await loadProfile(currentUserId.current);
    }
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      // Signed in but profile not loaded yet still counts as loading, so the
      // root never guesses which group to show.
      isLoading: isStarting || (session !== null && profile === null),
      session,
      profile,
      refreshProfile,
      isFinishingSignUp,
      setFinishingSignUp,
    }),
    [isStarting, session, profile, refreshProfile, isFinishingSignUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Reads the auth state. Must be used inside <AuthProvider>. */
export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return state;
}
