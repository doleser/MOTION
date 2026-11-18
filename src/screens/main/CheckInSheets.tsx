import {useState, type ReactNode} from 'react';
import {StyleSheet, Text} from 'react-native';

import {MotionButton} from '../../components/MotionButton';
import {MotionSheet} from '../../components/MotionSheet';
import {DEMO_TOOLS_ENABLED, type DemoLocation} from '../../services/demoLocation';
import {colors, typography} from '../../theme';
import {isDismissible, type CheckInSheet} from './checkInFlow';
import type {CheckInFlow} from './useCheckInFlow';

interface CheckInSheetsProps {
  flow: CheckInFlow;
  courtName: string;
  /** BACK TO MAP. */
  onBackToMap: () => void;
}

const DEMO_LABELS: Record<DemoLocation, string> = {
  at_court: 'AT THE COURT',
  too_far: 'TOO FAR',
  denied: 'PERMISSION DENIED',
  unavailable: 'UNAVAILABLE',
};

interface SheetContent {
  title: string;
  body: string;
  children: ReactNode;
  demo?: boolean;
}

/**
 * The check-in overlays. Figma: OVERLAY / Verify location, Checking
 * location, Too far, Permission denied, Location unavailable, Check out,
 * Privacy expired, Demo tools.
 *
 * One Modal stays mounted and only its content changes: presenting a new
 * Modal while another is closing can be dropped on iOS.
 */
export function CheckInSheets({flow, courtName, onBackToMap}: CheckInSheetsProps) {
  // Keep drawing the last sheet while the Modal fades out.
  const [lastSheet, setLastSheet] = useState<CheckInSheet>('prompt');
  if (flow.sheet && flow.sheet !== lastSheet) {
    setLastSheet(flow.sheet);
  }
  const shown = flow.sheet ?? lastSheet;
  const content = contentFor(shown, flow, courtName, () => {
    flow.close();
    onBackToMap();
  });

  const dismissible =
    flow.sheet !== null && isDismissible(flow.sheet) && !flow.checkingOut;

  return (
    <MotionSheet
      visible={flow.sheet !== null}
      onDismiss={dismissible ? flow.close : undefined}
      title={content.title}
      body={content.body}
      accent={content.demo}
      compact={content.demo}
      position={content.demo ? 'top' : 'bottom'}>
      {content.children}
    </MotionSheet>
  );
}

function contentFor(
  sheet: CheckInSheet,
  flow: CheckInFlow,
  courtName: string,
  backToMap: () => void,
): SheetContent {
  switch (sheet) {
    case 'prompt':
      return {
        title: 'CHECK IN\nAT THE COURT',
        body: 'We verify you are near this court before sharing player details. Your location is not shown to other players.',
        children: (
          <>
            <Text style={styles.courtName}>{courtName}</Text>
            <MotionButton label="VERIFY LOCATION" onPress={flow.verify} />
            <MotionButton label="NOT NOW" variant="secondary" onPress={flow.close} />
            {DEMO_TOOLS_ENABLED ? (
              <MotionButton
                label="PROTOTYPE / LOCATION SCENARIOS"
                variant="secondary"
                onPress={() => flow.open('demo')}
              />
            ) : null}
          </>
        ),
      };

    case 'verifying':
      return {
        title: 'VERIFYING\nPROXIMITY',
        body: 'Checking your location against the selected court…',
        children: (
          <>
            <MotionButton label="VERIFYING…" onPress={() => {}} disabled />
            <MotionButton label="CANCEL" variant="secondary" onPress={flow.cancel} />
          </>
        ),
      };

    case 'tooFar':
      return {
        title: 'MOVE CLOSER',
        body: 'We could not verify that you are near this court. Player details stay private. Try again when you arrive.',
        children: (
          <>
            <MotionButton label="TRY AGAIN" onPress={flow.verify} />
            <MotionButton label="BACK TO MAP" variant="secondary" onPress={backToMap} />
          </>
        ),
      };

    case 'denied':
      return {
        title: 'LOCATION\nIS OFF',
        body: 'Allow location access in device settings, then retry. You can still browse court counts.',
        children: (
          <>
            <MotionButton label="RETRY LOCATION CHECK" onPress={flow.retryLocation} />
            <MotionButton label="KEEP BROWSING" variant="secondary" onPress={flow.close} />
          </>
        ),
      };

    case 'unavailable':
      return {
        title: 'CANNOT VERIFY\nRIGHT NOW',
        body: 'Your location could not be read. Nothing changed. Check connectivity and retry.',
        children: (
          <>
            <MotionButton label="TRY AGAIN" onPress={flow.verify} />
            <MotionButton label="KEEP BROWSING" variant="secondary" onPress={flow.close} />
          </>
        ),
      };

    case 'checkOut':
      return {
        title: 'LEAVE THIS\nCOURT?',
        body: 'You will leave the queue and lose access to this court’s player list. Your own match result remains available.',
        children: (
          <>
            <MotionButton
              label="CHECK OUT"
              onPress={flow.confirmCheckOut}
              loading={flow.checkingOut}
            />
            <MotionButton
              label="STAY CHECKED IN"
              variant="secondary"
              onPress={flow.close}
              disabled={flow.checkingOut}
            />
          </>
        ),
      };

    case 'expired':
      return {
        title: 'CHECK-IN\nREQUIRED',
        body: 'You are no longer checked in here. Player identities are hidden until proximity verification succeeds again.',
        children: (
          <>
            <MotionButton label="VERIFY CHECK-IN" onPress={flow.verify} />
            <MotionButton label="BACK TO MAP" variant="secondary" onPress={backToMap} />
          </>
        ),
      };

    case 'demo':
      return {
        demo: true,
        title: 'PROTOTYPE\nCONTROLS',
        body: 'These simulate device and server events. They are not production app controls.',
        children: (
          <>
            <Text style={styles.demoState}>
              LOCATION: {flow.demoLocation ? DEMO_LABELS[flow.demoLocation] : 'REAL GPS'}
            </Text>
            <DemoButton label="LOCATION: AT THE COURT" onPress={() => flow.runDemo('at_court')} />
            <DemoButton label="LOCATION: TOO FAR" onPress={() => flow.runDemo('too_far')} />
            <DemoButton
              label="LOCATION: PERMISSION DENIED"
              onPress={() => flow.runDemo('denied')}
            />
            <DemoButton
              label="LOCATION: UNAVAILABLE"
              onPress={() => flow.runDemo('unavailable')}
            />
            <DemoButton label="CHECK-IN EXPIRED" onPress={() => flow.runDemo('expired')} />
            <DemoButton label="SESSION EXPIRED" onPress={() => flow.runDemo('session')} />
            <DemoButton label="RESET ENTIRE DEMO" onPress={() => flow.runDemo('reset')} />
          </>
        ),
      };
  }
}

function DemoButton({label, onPress}: {label: string; onPress: () => void}) {
  return <MotionButton label={label} variant="secondary" onPress={onPress} />;
}

const styles = StyleSheet.create({
  courtName: {
    ...typography.label,
    color: colors.yellow,
  },
  demoState: {
    ...typography.label,
    color: colors.text,
  },
});
