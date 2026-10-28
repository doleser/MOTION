import {getErrorMessage, ServiceError} from './errors';

describe('getErrorMessage', () => {
  it('returns the service message for a ServiceError', () => {
    const error = new ServiceError('underage', 'You must be 18 or older to use Motion.');
    expect(getErrorMessage(error)).toBe('You must be 18 or older to use Motion.');
  });

  it('returns a generic message for anything else', () => {
    expect(getErrorMessage(new Error('database down'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(getErrorMessage('nope')).toBe('Something went wrong. Please try again.');
  });
});
