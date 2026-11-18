/**
 * Runs the check-in overlays for one court: verify location, check in,
 * check out, and the Prototype Controls. The screen draws the sheets
 * (CheckInSheets) and decides where success leads.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, AppState, Linking} from 'react-native';

import {signOut} from '../../services/auth';
import {checkIn, checkOut, getMyCheckIn, type CheckIn} from '../../services/checkIns';
import type {LatLng} from '../../services/courts';
import {
  getDemoLocation,
  setDemoLocation,
  type DemoLocation,
} from '../../services/demoLocation';
import {getErrorMessage, isServiceError} from '../../services/errors';
import {getCheckInLocation} from '../../services/location';
import {failureForCheckInError, sheetForLocation, type CheckInSheet} from './checkInFlow';

/** The court being checked into. null while it's still loading. */
export interface CheckInCourt extends LatLng {
  id: number;
  name: string;
}

/** Prototype Controls buttons (Figma: OVERLAY / Demo tools). */
export type DemoAction = DemoLocation | 'expired' | 'session' | 'reset';

interface Options {
  court: CheckInCourt | null;
  /** The player is now checked in at `court`. */
  onCheckedIn: (visit: CheckIn) => void;
  /** check_in said the court can't take check-ins: reload it. */
  onCourtUnavailable: () => void;
  /** CHECK OUT finished. */
  onCheckedOut?: () => void;
}

export interface CheckInFlow {
  sheet: CheckInSheet | null;
  /** The signed-in player's open visit (any court), or null. */
  myCheckIn: CheckIn | null;
  checkingOut: boolean;
  /** The Prototype Controls location override, or null for real GPS. */
  demoLocation: DemoLocation | null;
  open: (sheet: CheckInSheet) => void;
  close: () => void;
  /** VERIFY LOCATION / TRY AGAIN: read the location and call check_in. */
  verify: () => void;
  /** CANCEL while verifying. */
  cancel: () => void;
  /** RETRY LOCATION CHECK: asks again, or opens Settings if the OS won't. */
  retryLocation: () => void;
  confirmCheckOut: () => void;
  /** Reloads myCheckIn. Resolves undefined if the request failed. */
  refreshMyCheckIn: () => Promise<CheckIn | null | undefined>;
  runDemo: (action: DemoAction) => void;
}

/** check_out, treating "already closed" (expired or swept) as done. */
async function closeOpenVisit(): Promise<void> {
  try {
    await checkOut();
  } catch (e) {
    if (!isServiceError(e, 'not_checked_in')) {
      throw e;
    }
  }
}

/** What one verify attempt needs from the hook. */
interface Attempt {
  court: CheckInCourt;
  /** False once the screen unmounted or the attempt was cancelled or replaced. */
  isCurrent: () => boolean;
  setSheet: (sheet: CheckInSheet | null) => void;
  setMyCheckIn: (visit: CheckIn | null) => void;
  setCanAskAgain: (value: boolean) => void;
  onCheckedIn: (visit: CheckIn) => void;
  onCourtUnavailable: () => void;
  /** Check out of the other court, then verify here again. */
  switchCourt: () => void;
}

/** Reads the location, calls check_in, and picks the next sheet. */
async function runVerify(a: Attempt): Promise<void> {
  a.setSheet('verifying');

  const reading = await getCheckInLocation(a.court);
  if (!a.isCurrent()) {
    return;
  }
  if (!reading.ok) {
    a.setCanAskAgain(reading.canAskAgain);
    a.setSheet(sheetForLocation(reading));
    return;
  }

  let visit: CheckIn;
  try {
    visit = await checkIn(a.court.id, reading.coords.latitude, reading.coords.longitude);
  } catch (e) {
    if (a.isCurrent()) {
      await handleFailure(e, a);
    }
    return;
  }
  // Even if cancelled after the request landed, the visit exists.
  a.setMyCheckIn(visit);
  if (a.isCurrent()) {
    a.setSheet(null);
    a.onCheckedIn(visit);
  }
}

async function handleFailure(error: unknown, a: Attempt): Promise<void> {
  const failure = failureForCheckInError(error);
  switch (failure.kind) {
    case 'sheet':
      a.setSheet(failure.sheet);
      return;
    // Alerts open while the sheet is still up and close it themselves: an
    // Alert raised while a Modal is closing can be dropped on iOS.
    case 'courtUnavailable':
      a.onCourtUnavailable();
      Alert.alert('Court not available', `${a.court.name} can't take check-ins right now.`, [
        {text: 'OK', onPress: () => a.setSheet(null)},
      ]);
      return;
    case 'signedOut':
      a.setSheet(null);
      await signOut().catch(() => {});
      return;
    case 'alreadyCheckedIn': {
      let mine: CheckIn | null;
      try {
        mine = await getMyCheckIn();
      } catch {
        mine = null;
      }
      if (!a.isCurrent()) {
        return;
      }
      a.setMyCheckIn(mine);
      if (mine && mine.courtId === a.court.id) {
        a.setSheet(null);
        a.onCheckedIn(mine);
      } else if (mine) {
        Alert.alert(
          'Already checked in',
          `You're checked in at another court. Check out there and check in at ${a.court.name}?`,
          [
            {text: 'Cancel', style: 'cancel', onPress: () => a.setSheet(null)},
            {text: 'Switch', onPress: a.switchCourt},
          ],
        );
      } else {
        // The other visit ended in between, or it couldn't be loaded.
        a.setSheet('unavailable');
      }
      return;
    }
  }
}

export function useCheckInFlow({
  court,
  onCheckedIn,
  onCourtUnavailable,
  onCheckedOut,
}: Options): CheckInFlow {
  const [sheet, setSheet] = useState<CheckInSheet | null>(null);
  const [myCheckIn, setMyCheckIn] = useState<CheckIn | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [demoLocation, setDemoState] = useState(getDemoLocation);

  // Latest props for the async steps, so a callback never uses an old court.
  const latest = useRef({court, onCheckedIn, onCourtUnavailable, onCheckedOut});
  useEffect(() => {
    latest.current = {court, onCheckedIn, onCourtUnavailable, onCheckedOut};
  });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Bumped by every verify and by CANCEL; a result for an older number is ignored.
  const attempt = useRef(0);
  // Set when RETRY sent the player to Settings: verify again on return.
  const awaitingSettings = useRef(false);
  // switchCourt calls verify and verify offers switchCourt; this breaks the loop.
  const switchCourtRef = useRef<() => void>(() => {});

  const setMyCheckInIfMounted = useCallback((visit: CheckIn | null) => {
    if (mounted.current) {
      setMyCheckIn(visit);
    }
  }, []);

  const refreshMyCheckIn = useCallback(async () => {
    try {
      const visit = await getMyCheckIn();
      setMyCheckInIfMounted(visit);
      return visit;
    } catch {
      return undefined;
    }
  }, [setMyCheckInIfMounted]);

  const verify = useCallback(async () => {
    const target = latest.current.court;
    if (!target) {
      return;
    }
    const id = ++attempt.current;
    await runVerify({
      court: target,
      isCurrent: () => mounted.current && id === attempt.current,
      setSheet,
      setMyCheckIn: setMyCheckInIfMounted,
      setCanAskAgain,
      onCheckedIn: (visit) => latest.current.onCheckedIn(visit),
      onCourtUnavailable: () => latest.current.onCourtUnavailable(),
      switchCourt: () => switchCourtRef.current(),
    });
  }, [setMyCheckInIfMounted]);

  const switchCourt = useCallback(async () => {
    setSheet('verifying');
    try {
      await closeOpenVisit();
    } catch {
      if (mounted.current) {
        setSheet('unavailable');
      }
      return;
    }
    setMyCheckInIfMounted(null);
    if (mounted.current) {
      await verify();
    }
  }, [verify, setMyCheckInIfMounted]);

  useEffect(() => {
    switchCourtRef.current = () => void switchCourt();
  }, [switchCourt]);

  const cancel = useCallback(() => {
    attempt.current++;
    setSheet(null);
  }, []);

  const retryLocation = useCallback(() => {
    if (canAskAgain || getDemoLocation()) {
      void verify();
      return;
    }
    // The OS won't show the popup again; MOTION's page in Settings has the toggle.
    awaitingSettings.current = true;
    Linking.openSettings().catch(() => {
      awaitingSettings.current = false;
    });
  }, [canAskAgain, verify]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && awaitingSettings.current) {
        awaitingSettings.current = false;
        void verify();
      }
    });
    return () => subscription.remove();
  }, [verify]);

  const confirmCheckOut = useCallback(async () => {
    setCheckingOut(true);
    try {
      await closeOpenVisit();
    } catch (e) {
      if (mounted.current) {
        setCheckingOut(false);
        Alert.alert('Could not check out', getErrorMessage(e));
      }
      return;
    }
    if (!mounted.current) {
      return;
    }
    setCheckingOut(false);
    setMyCheckIn(null);
    setSheet(null);
    latest.current.onCheckedOut?.();
  }, []);

  const runDemo = useCallback(
    async (action: DemoAction) => {
      switch (action) {
        case 'at_court':
        case 'too_far':
        case 'denied':
        case 'unavailable':
          setDemoLocation(action);
          setDemoState(action);
          setSheet('prompt');
          return;
        case 'expired':
          // Really end the visit, so the server agrees with what's shown.
          await closeOpenVisit().catch(() => {});
          setMyCheckInIfMounted(null);
          if (mounted.current) {
            setSheet('expired');
          }
          return;
        case 'session':
          setSheet(null);
          await signOut().catch(() => {});
          return;
        case 'reset':
          setDemoLocation(null);
          setDemoState(null);
          await closeOpenVisit().catch(() => {});
          setMyCheckInIfMounted(null);
          if (mounted.current) {
            setSheet(null);
          }
          return;
      }
    },
    [setMyCheckInIfMounted],
  );

  return {
    sheet,
    myCheckIn,
    checkingOut,
    demoLocation,
    open: setSheet,
    close: useCallback(() => setSheet(null), []),
    verify: useCallback(() => void verify(), [verify]),
    cancel,
    retryLocation,
    confirmCheckOut: useCallback(() => void confirmCheckOut(), [confirmCheckOut]),
    refreshMyCheckIn,
    runDemo: useCallback((action: DemoAction) => void runDemo(action), [runDemo]),
  };
}
