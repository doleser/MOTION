import {createAccount} from './account';

describe('createAccount', () => {
  it('rejects an underage player before saving an account', async () => {
    await expect(
      createAccount({
        email: 'new@uw.edu',
        password: 'secret1',
        confirmedAdult: false,
        profile: {username: 'new_player', level: 'beginner'},
      }),
    ).rejects.toMatchObject({
      code: 'underage',
      message: 'You must be 18 or older to use Motion.',
    });
  });
});
