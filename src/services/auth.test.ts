import {
  getEmailError,
  getPasswordError,
  MIN_PASSWORD_LENGTH,
  onAuthStateChange,
  signInWithPassword,
} from './auth';
import {isServiceError} from './errors';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

const auth = supabase.auth as unknown as Record<
  'signInWithPassword' | 'onAuthStateChange',
  jest.Mock
>;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('getEmailError', () => {
  it('accepts a normal email', () => {
    expect(getEmailError('player@uw.edu')).toBeNull();
  });

  it('rejects an email with no domain', () => {
    expect(getEmailError('player')).toBe('Enter a valid email address.');
  });
});

describe('getPasswordError', () => {
  it('accepts a password at the minimum length', () => {
    expect(getPasswordError('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('rejects a shorter password', () => {
    expect(getPasswordError('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  });
});

describe('signInWithPassword', () => {
  it('returns the signed-in user', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {session: {user: {id: 'u1', email: 'player@uw.edu'}}},
      error: null,
    });
    await expect(
      signInWithPassword({email: ' player@uw.edu ', password: 'secret1'}),
    ).resolves.toEqual({user: {id: 'u1', email: 'player@uw.edu'}});
    // Spaces around the email are trimmed.
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@uw.edu',
      password: 'secret1',
    });
  });

  it('turns a wrong password into invalid_credentials', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {session: null},
      error: {code: 'invalid_credentials', message: 'Invalid login credentials'},
    });
    const error = await signInWithPassword({email: 'player@uw.edu', password: 'nope'}).catch(
      (e: unknown) => e,
    );
    expect(isServiceError(error, 'invalid_credentials')).toBe(true);
  });
});

describe('onAuthStateChange', () => {
  /** Subscribes, and returns a function that fakes a Supabase auth event. */
  function subscribe(listener: jest.Mock) {
    const unsubscribe = jest.fn();
    auth.onAuthStateChange.mockReturnValue({data: {subscription: {unsubscribe}}});
    const stop = onAuthStateChange(listener);
    const emit = auth.onAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: {user: {id: string; email?: string}} | null,
    ) => void;
    return {emit, stop, unsubscribe};
  }

  const session = (id: string) => ({user: {id, email: `${id}@uw.edu`}});

  it('reports sign-ins and sign-outs', () => {
    const listener = jest.fn();
    const {emit} = subscribe(listener);

    emit('INITIAL_SESSION', null);
    emit('SIGNED_IN', session('u1'));
    emit('SIGNED_OUT', null);

    expect(listener.mock.calls).toEqual([
      [{user: {id: 'u1', email: 'u1@uw.edu'}}],
      [null],
    ]);
  });

  it('skips the start-up session and token refreshes for the same user', () => {
    const listener = jest.fn();
    const {emit} = subscribe(listener);

    emit('INITIAL_SESSION', session('u1'));
    emit('TOKEN_REFRESHED', session('u1'));
    emit('SIGNED_IN', session('u1'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops listening when the returned function is called', () => {
    const {stop, unsubscribe} = subscribe(jest.fn());
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
