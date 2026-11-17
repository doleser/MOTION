import {ServiceError} from '../../services/errors';
import {failureForCheckInError, isDismissible, sheetForLocation} from './checkInFlow';

describe('failureForCheckInError', () => {
  it('shows MOVE CLOSER when too far', () => {
    expect(failureForCheckInError(new ServiceError('too_far', 'Too far from the court.'))).toEqual(
      {kind: 'sheet', sheet: 'tooFar'},
    );
  });

  it('reloads the court when it is not available', () => {
    expect(
      failureForCheckInError(new ServiceError('court_unavailable', 'Court is not available.')),
    ).toEqual({kind: 'courtUnavailable'});
  });

  it('looks up the open visit when already checked in', () => {
    expect(
      failureForCheckInError(new ServiceError('already_checked_in', 'Already checked in.')),
    ).toEqual({kind: 'alreadyCheckedIn'});
  });

  it('signs out when the session is gone', () => {
    expect(failureForCheckInError(new ServiceError('not_signed_in', 'Not signed in.'))).toEqual({
      kind: 'signedOut',
    });
  });

  it('shows CANNOT VERIFY for network and unexpected errors', () => {
    expect(failureForCheckInError(new TypeError('Network request failed'))).toEqual({
      kind: 'sheet',
      sheet: 'unavailable',
    });
  });
});

describe('sheetForLocation', () => {
  it('maps the reading failure to its overlay', () => {
    expect(sheetForLocation({ok: false, reason: 'denied', canAskAgain: false})).toBe('denied');
    expect(sheetForLocation({ok: false, reason: 'unavailable', canAskAgain: true})).toBe(
      'unavailable',
    );
  });
});

describe('isDismissible', () => {
  it('blocks closing only while verifying', () => {
    expect(isDismissible('verifying')).toBe(false);
    expect(isDismissible('prompt')).toBe(true);
    expect(isDismissible('checkOut')).toBe(true);
  });
});
