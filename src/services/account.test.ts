import {createAccount, type CreateAccountInput} from './account';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

const m = supabase as unknown as {
  auth: Record<'signUp' | 'signInWithPassword' | 'signOut' | 'getSession', jest.Mock>;
  rpc: jest.Mock;
  from: jest.Mock;
};

const row = {
  user_id: 'u1', username: 'hooper2', elo: 800, open_to_challenges: true,
  position: null, real_name: 'Jordan Lee', height_cm: 188, tags: null, home_court_id: 6,
  onboarded_at: '2026-11-03T18:00:00Z', appeal_count: 0,
};

function signUp(changes: Partial<CreateAccountInput> = {}): CreateAccountInput {
  return {
    email: 'new@uw.edu', password: 'secret1', confirmedAdult: true, realName: 'Jordan Lee',
    username: 'hooper2', level: 'intermediate', ...changes,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  m.auth.signUp.mockResolvedValue({data: {session: {}}, error: null});
  m.auth.signOut.mockResolvedValue({error: null});
  m.auth.getSession.mockResolvedValue({data: {session: {user: {id: 'u1'}}}});
  m.rpc.mockResolvedValue({data: row, error: null});
  const single = jest.fn().mockResolvedValue({data: row, error: null});
  m.from.mockReturnValue({select: () => ({eq: () => ({single})})});
});

describe('createAccount', () => {
  it('rejects an underage player before touching Supabase', async () => {
    await expect(createAccount(signUp({confirmedAdult: false}))).rejects.toMatchObject({code: 'underage'});
    expect(m.auth.signUp).not.toHaveBeenCalled();
  });

  it('signs up, saves the profile, and returns it', async () => {
    const profile = await createAccount(signUp({heightCm: 188, homeCourtId: 6}));
    expect(m.rpc).toHaveBeenCalledWith('complete_profile', {
      p_username: 'hooper2', p_level: 'intermediate', p_position: null,
      p_height_cm: 188, p_tags: null, p_home_court_id: 6, p_real_name: 'Jordan Lee',
    });
    expect(profile).toMatchObject({username: 'hooper2', realName: 'Jordan Lee', elo: 800, heightCm: 188, homeCourtId: 6});
    expect(m.auth.signOut).not.toHaveBeenCalled();
  });

  it('rejects a blank name before touching Supabase', async () => {
    await expect(createAccount(signUp({realName: '   '}))).rejects.toMatchObject({code: 'missing_real_name'});
    expect(m.auth.signUp).not.toHaveBeenCalled();
  });

  it('trims spaces around the name before saving it', async () => {
    await createAccount(signUp({realName: '  Jordan Lee  '}));
    expect(m.rpc).toHaveBeenCalledWith('complete_profile', expect.objectContaining({p_real_name: 'Jordan Lee'}));
  });

  it('reports an email that belongs to someone else', async () => {
    m.auth.signUp.mockResolvedValue({data: {}, error: {code: 'user_already_exists', message: 'x'}});
    m.auth.signInWithPassword.mockResolvedValue({error: {code: 'invalid_credentials', message: 'x'}});
    await expect(createAccount(signUp())).rejects.toMatchObject({code: 'email_taken'});
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('reports a taken username and signs out', async () => {
    m.rpc.mockResolvedValue({data: null, error: {code: '23505', message: 'duplicate'}});
    await expect(createAccount(signUp())).rejects.toMatchObject({code: 'username_taken'});
    expect(m.auth.signOut).toHaveBeenCalled();
  });

  it('finishes a half-done earlier attempt with the same email and password', async () => {
    m.auth.signUp.mockResolvedValue({data: {}, error: {code: 'user_already_exists', message: 'x'}});
    m.auth.signInWithPassword.mockResolvedValue({error: null});
    await expect(createAccount(signUp())).resolves.toMatchObject({username: 'hooper2'});
  });

  it('treats "already complete" with a different username as email_taken', async () => {
    m.rpc.mockResolvedValue({data: null, error: {code: '55000', message: 'done'}});
    await expect(createAccount(signUp({username: 'someone_else'}))).rejects.toMatchObject({code: 'email_taken'});
    expect(m.auth.signOut).toHaveBeenCalled();
  });
});