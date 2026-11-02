import {createAccount, type CreateAccountInput} from './account';
import {getSession, signOut} from './auth';
import {getMyProfile, STARTING_ELO_BY_LEVEL} from './profile';

/** A valid sign-up; each test overrides what it needs. */
function signUp(changes: Partial<CreateAccountInput> = {}): CreateAccountInput {
  return {
    email: 'new@uw.edu',
    password: 'secret1',
    confirmedAdult: true,
    username: 'new_player',
    level: 'beginner',
    ...changes,
  };
}

describe('createAccount', () => {
  afterEach(async () => {
    await signOut();
  });

  it('rejects an underage player before saving an account', async () => {
    await expect(
      createAccount(signUp({email: 'young@uw.edu', confirmedAdult: false})),
    ).rejects.toMatchObject({
      code: 'underage',
      message: 'You must be 18 or older to use Motion.',
    });
    expect(await getSession()).toBeNull();
  });

  it('creates the account, saves the profile, and signs in', async () => {
    const profile = await createAccount(
      signUp({
        email: 'hooper2@uw.edu',
        username: 'hooper2',
        level: 'intermediate',
        heightCm: 188,
        homeCourtId: 6,
      }),
    );

    expect(profile).toMatchObject({
      username: 'hooper2',
      elo: STARTING_ELO_BY_LEVEL.intermediate,
      heightCm: 188,
      homeCourtId: 6,
    });
    expect((await getSession())?.user.email).toBe('hooper2@uw.edu');
    expect(await getMyProfile()).toEqual(profile);
  });

  it('reports an already-registered email', async () => {
    await expect(
      createAccount(signUp({email: 'taken@uw.edu', username: 'fresh_one'})),
    ).rejects.toMatchObject({code: 'email_taken'});
    expect(await getSession()).toBeNull();
  });

  it('reports a taken username, ignoring case', async () => {
    await expect(
      createAccount(signUp({email: 'other@uw.edu', username: 'Hooper'})),
    ).rejects.toMatchObject({code: 'username_taken'});
    expect(await getSession()).toBeNull();
  });
});
