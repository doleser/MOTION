/**
 * Holds sign-up answers in memory until the last step saves them.
 *
 * Nothing is saved while the user moves through sign-up: HomeCourt's Finish
 * sends everything (account + profile) in one createAccount call. If the user
 * closes the app midway, the draft is gone and nothing was created.
 *
 * The provider wraps the signed-out stack (AuthStack). Signing in removes
 * that stack, which also clears the draft, including the password.
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type {SkillLevel} from '../../services/profile';

/** Every field is optional because it fills in one screen at a time. */
export interface OnboardingDraft {
  // From SignUp
  email?: string;
  password?: string;
  confirmedAdult?: boolean;
  // From the onboarding screens
  username?: string;
  position?: string;
  heightCm?: number;
  tags?: string[];
  level?: SkillLevel;
}

interface OnboardingDraftState {
  draft: OnboardingDraft;
  /** Merges `changes` into the draft. Pass `undefined` to clear a field. */
  updateDraft: (changes: OnboardingDraft) => void;
}

const OnboardingDraftContext = createContext<OnboardingDraftState | null>(null);

export function OnboardingDraftProvider({children}: {children: ReactNode}) {
  const [draft, setDraft] = useState<OnboardingDraft>({});

  const updateDraft = useCallback((changes: OnboardingDraft) => {
    setDraft((current) => ({...current, ...changes}));
  }, []);

  const value = useMemo(() => ({draft, updateDraft}), [draft, updateDraft]);

  return (
    <OnboardingDraftContext.Provider value={value}>
      {children}
    </OnboardingDraftContext.Provider>
  );
}

/** Reads the draft. Must be used inside <OnboardingDraftProvider>. */
export function useOnboardingDraft(): OnboardingDraftState {
  const state = useContext(OnboardingDraftContext);
  if (!state) {
    throw new Error(
      'useOnboardingDraft must be used inside <OnboardingDraftProvider>.',
    );
  }
  return state;
}
