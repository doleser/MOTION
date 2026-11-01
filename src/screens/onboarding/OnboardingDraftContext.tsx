/**
 * Holds sign-up answers in memory until the last step saves them.
 *
 * Nothing is saved while the user moves through sign-up: StartingElo's
 * "Create account" sends everything (account + profile) in one createAccount
 * call. If the user
 * closes the app midway, the draft is gone and nothing was created.
 *
 * The provider wraps the signed-out stack (AuthStack), so every sign-up
 * screen shares it and going back keeps earlier answers. Signing in removes
 * that stack, which also clears the draft.
 *
 * The password lives ONLY here, in memory: never write the draft to storage
 * and never log it.
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
  // From ChooseHandle and ProfileDetails
  username?: string;
  position?: string;
  heightCm?: number;
  tags?: string[];
  preferredCourtIds?: number[];
  // From Experience
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
