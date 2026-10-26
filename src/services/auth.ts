/**
 * Auth service (STUB).
 *
 * A fake, in-memory stand-in for Supabase Auth. Where Supabase has a matching
 * call, the name and arguments mirror `supabase.auth.*`, so the real version
 * can replace this file without changing any screens.
 *
 * New accounts are NOT created here; see `createAccount` in account.ts.
 *
 * Everything lives in memory: reloading the app wipes all accounts.
 */
import {ServiceError} from './errors';
import {fakeDelay} from './fakeDelay';

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

// ---------- Fake in-memory state ----------

/** Stub only: real passwords are never stored by the app. */
interface StoredUser extends AuthUser {
  password: string;
}

/** Pretend these emails already have accounts. */
const TAKEN_EMAILS = ['taken@uw.edu'];

/**
 * Pretend someone signs up with these while you're onboarding: they pass the
 * check on SignUp but fail at createAccount. Use "sniped@uw.edu" to test it.
 */
const TAKEN_AT_SAVE_EMAILS = ['sniped@uw.edu'];

const usersByEmail = new Map<string, StoredUser>();
const listeners = new Set<AuthListener>();
let currentSession: Session | null = null;
let nextUserNumber = 1;

function setSession(session: Session | null): void {
  currentSession = session;
  listeners.forEach((listener) => listener(session));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmailTaken(email: string): boolean {
  const key = normalizeEmail(email);
  return TAKEN_EMAILS.includes(key) || usersByEmail.has(key);
}

// ---------- Public API ----------

/**
 * True if no account uses this email yet. Works while signed out.
 * Throws 'invalid_email' if the email is badly formatted.
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  await fakeDelay();
  const formatError = getEmailError(email);
  if (formatError) {
    throw new ServiceError('invalid_email', formatError);
  }
  return !isEmailTaken(email);
}

export async function signInWithPassword({
  email,
  password,
}: Credentials): Promise<Session> {
  await fakeDelay();
  const user = usersByEmail.get(normalizeEmail(email));

  // Same message for "no such email" and "wrong password", so the login
  // screen doesn't reveal which emails have accounts.
  if (!user || user.password !== password) {
    throw new ServiceError('invalid_credentials', 'Wrong email or password.');
  }

  const session: Session = {user: {id: user.id, email: user.email}};
  setSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  await fakeDelay();
  setSession(null);
}

/** The current session, or null if signed out. */
export async function getSession(): Promise<Session | null> {
  await fakeDelay();
  return currentSession;
}

/**
 * Calls `listener` every time the user signs in or out.
 * Returns a function that stops listening.
 */
export function onAuthStateChange(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------- Stub-only helpers (used by the other stubs) ----------
// The real backend does these on the server, so they disappear with the stubs.

/** Throws if an account can't be created with this email and password. */
export function stubCheckNewUser(email: string, password: string): void {
  const emailError = getEmailError(email);
  if (emailError) {
    throw new ServiceError('invalid_email', emailError);
  }
  const passwordError = getPasswordError(password);
  if (passwordError) {
    throw new ServiceError('weak_password', passwordError);
  }
  if (isEmailTaken(email) || TAKEN_AT_SAVE_EMAILS.includes(normalizeEmail(email))) {
    throw new ServiceError(
      'email_taken',
      'An account with this email already exists. Try logging in.',
    );
  }
}

/** Adds the user. Does NOT sign them in. Call stubCheckNewUser first. */
export function stubInsertUser(email: string, password: string): AuthUser {
  const user: StoredUser = {
    id: `user-${nextUserNumber++}`,
    email: normalizeEmail(email),
    password,
  };
  usersByEmail.set(user.email, user);
  return {id: user.id, email: user.email};
}

/** Lets the profile stub read the signed-in user without a fake delay. */
export function peekSession(): Session | null {
  return currentSession;
}
