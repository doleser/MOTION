/**
 * Auth service: sign in, sign out, and who is signed in, using Supabase Auth.
 *
 * New accounts are NOT created here; see `createAccount` in account.ts.
 *
 * Supabase saves the session on the phone, so the user stays signed in
 * after the app is closed and reopened.
 */
import type {Session as SupabaseSession} from '@supabase/supabase-js';

import {fromAuthError} from './errors';
import {supabase} from './supabase';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Session {
  user: AuthUser;
}

export interface Credentials {
  email: string;
  password: string;
}

export type AuthListener = (session: Session | null) => void;

/** Same minimum as supabase/config.toml (minimum_password_length). */
export const MIN_PASSWORD_LENGTH = 6;

// ---------- Format rules (instant, no server call) ----------

export function getEmailError(email: string): string | null {
  if (/^\S+@\S+\.\S+$/.test(email.trim())) {
    return null;
  }
  return 'Enter a valid email address.';
}

export function getPasswordError(password: string): string | null {
  if (password.length >= MIN_PASSWORD_LENGTH) {
    return null;
  }
  return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
}

// ---------- Public API ----------

export async function signInWithPassword({
  email,
  password,
}: Credentials): Promise<Session> {
  const {data, error} = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    throw fromAuthError(error);
  }
  return toSession(data.session);
}

export async function signOut(): Promise<void> {
  const {error} = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/** The current session, or null if signed out. */
export async function getSession(): Promise<Session | null> {
  const {data, error} = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session ? toSession(data.session) : null;
}

/**
 * Calls `listener` every time a different user signs in, or the user signs
 * out. Returns a function that stops listening.
 *
 * Not called for the session found at start-up (use getSession for that) or
 * for Supabase's hourly token refresh, which keeps the same user. Otherwise
 * the app would reload the profile, and flash a spinner, every hour.
 */
export function onAuthStateChange(listener: AuthListener): () => void {
  // The user last reported; undefined until Supabase sends its first event.
  let lastUserId: string | null | undefined;

  const {data} = supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user.id ?? null;
    const isStartUp = event === 'INITIAL_SESSION';
    const isSameUser = userId === lastUserId;
    lastUserId = userId;
    if (isStartUp || isSameUser) {
      return;
    }
    listener(session ? toSession(session) : null);
  });

  return () => data.subscription.unsubscribe();
}

/** Keeps only what the app uses from Supabase's session. */
function toSession(session: SupabaseSession): Session {
  return {user: {id: session.user.id, email: session.user.email ?? ''}};
}
