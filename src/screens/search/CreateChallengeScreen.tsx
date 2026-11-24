import {DateTimePickerAndroid} from '@react-native-community/datetimepicker';
import {useCallback, useEffect, useState} from 'react';
import {Platform} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';
import {
  checkStartTime,
  getEarliestStart,
  getLatestStart,
  MATCH_LENGTHS,
  START_STEP_MINUTES,
  toAllowedStart,
} from '../../services/challengeTime';
import {createChallenge} from '../../services/challenges';
import {listCourts} from '../../services/courts';
import {getErrorMessage} from '../../services/errors';
import {getPlayerProfile} from '../../services/players';
import {previewElo} from '../../services/results';
import {
  CreateChallengeScreenView,
  type SheetState,
  type StakesState,
} from './CreateChallengeScreenView';

/**
 * The challenge sheet over another player's profile (see SearchStack).
 * Loads the opponent and the courts, lets the player pick court, time,
 * type, and length, and sends the challenge.
 * CreateChallengeScreenView draws the sheet.
 */
export function CreateChallengeScreen({navigation, route}: SearchScreenProps<'CreateChallenge'>) {
  const {opponentId} = route.params;

  const [state, setState] = useState<SheetState>({kind: 'loading'});
  const [stakes, setStakes] = useState<StakesState>({kind: 'loading'});

  const [courtId, setCourtId] = useState<number | null>(null);
  const [isCourtListOpen, setIsCourtListOpen] = useState(false);
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [ranked, setRanked] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(MATCH_LENGTHS.defaultMinutes);

  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // The picker's limits, worked out when the sheet opens.
  const [now] = useState(() => new Date());
  const earliestStart = getEarliestStart(now);
  const latestStart = getLatestStart(now);

  // Loads the opponent and the court list. Returns a cleanup that drops the
  // answer if the sheet has closed.
  const load = useCallback(() => {
    let isCurrent = true;
    Promise.all([getPlayerProfile(opponentId), listCourts()]).then(
      ([opponent, courts]) => {
        if (isCurrent) setState({kind: 'ready', opponent, courts});
      },
      (e: unknown) => {
        if (isCurrent) setState({kind: 'error', message: getErrorMessage(e)});
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [opponentId]);

  useEffect(() => load(), [load]);

  // The Elo stakes load on their own, so a failure there doesn't block
  // sending; they're only shown for ranked.
  useEffect(() => {
    let isCurrent = true;
    previewElo(opponentId).then(
      (loaded) => {
        if (isCurrent) setStakes({kind: 'loaded', stakes: loaded});
      },
      () => {
        if (isCurrent) setStakes({kind: 'failed'});
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [opponentId]);

  function retryLoad() {
    setState({kind: 'loading'});
    load();
  }

  /** Any change clears the last send error, since it may no longer apply. */
  function changed() {
    setSendError(null);
  }

  function toggleCourtList() {
    setIsCourtListOpen((open) => !open);
    setIsTimePickerOpen(false);
  }

  function pickCourt(id: number) {
    setCourtId(id);
    setIsCourtListOpen(false);
    changed();
  }

  function pickTime(date: Date) {
    setStartsAt(toAllowedStart(date, new Date()));
    changed();
  }

  function pressTime() {
    setIsCourtListOpen(false);
    // Start from the current pick, or the earliest allowed time.
    const initial = startsAt ?? earliestStart;

    if (Platform.OS === 'android') {
      // Android has separate date and time dialogs: date first, then time.
      DateTimePickerAndroid.open({
        mode: 'date',
        value: initial,
        minimumDate: earliestStart,
        maximumDate: latestStart,
        onValueChange: (_event, date) => {
          DateTimePickerAndroid.open({
            mode: 'time',
            value: date,
            minuteInterval: START_STEP_MINUTES,
            onValueChange: (_timeEvent, time) => pickTime(time),
          });
        },
      });
      return;
    }

    // iOS: a wheel opens inside the sheet. Opening it shows a time, so
    // that time counts as picked.
    if (!isTimePickerOpen && !startsAt) {
      pickTime(initial);
    }
    setIsTimePickerOpen((open) => !open);
  }

  async function send() {
    if (state.kind !== 'ready' || courtId === null || startsAt === null) {
      return;
    }
    // The sheet may have been open a while: check the time hasn't passed.
    if (checkStartTime(startsAt, new Date()) === 'in_past') {
      setSendError('That time has passed. Pick a new time.');
      return;
    }

    setSendError(null);
    setIsSending(true);
    try {
      await createChallenge({opponentId, ranked, courtId, startsAt, durationMinutes});
      // Close the sheet; the profile shows "Challenge sent". A timestamp, so
      // a second send shows it again.
      navigation.popTo(
        'PlayerProfile',
        {userId: opponentId, challengeSentAt: Date.now()},
        {merge: true},
      );
    } catch (e) {
      setSendError(getErrorMessage(e));
      setIsSending(false);
    }
  }

  return (
    <CreateChallengeScreenView
      state={state}
      onRetryLoad={retryLoad}
      courtId={courtId}
      isCourtListOpen={isCourtListOpen}
      onToggleCourtList={toggleCourtList}
      onPickCourt={pickCourt}
      startsAt={startsAt}
      isTimePickerOpen={isTimePickerOpen}
      onPressTime={pressTime}
      onPickTime={pickTime}
      earliestStart={earliestStart}
      latestStart={latestStart}
      ranked={ranked}
      onChangeRanked={(value) => {
        setRanked(value);
        changed();
      }}
      durationMinutes={durationMinutes}
      onChangeDuration={(minutes) => {
        setDurationMinutes(minutes);
        changed();
      }}
      stakes={stakes}
      canSend={state.kind === 'ready' && courtId !== null && startsAt !== null}
      isSending={isSending}
      sendError={sendError}
      onSend={send}
      onGoBack={() => navigation.goBack()}
    />
  );
}
