import {MotionButton} from '../../components/MotionButton';
import type {SearchScreenProps} from '../../navigation/types';
import {PlaceholderLayout} from './PlaceholderLayout';
import {FAKE_CHALLENGES} from './fakeChallenges';

/**
 * PLACEHOLDER: one challenge. The player who received it can Accept or
 * Decline; the player who sent it can Cancel.
 */
export function ChallengeDetailsScreen({navigation, route}: SearchScreenProps<'ChallengeDetails'>) {
  const {challengeId} = route.params;
  // TODO: load the challenge and compare its opponent to the signed-in user.
  const isReceived =
    FAKE_CHALLENGES.find((c) => c.challengeId === challengeId)?.isReceived ?? false;

  // TODO: update the challenge. For now every action just returns to the inbox.
  const goBack = () => navigation.goBack();

  return (
    <PlaceholderLayout
      title="CHALLENGE"
      onBack={goBack}
      note={`The court, time, and opponent will show here. (challengeId: ${challengeId})`}>
      {isReceived ? (
        <>
          <MotionButton label="Accept" onPress={goBack} />
          <MotionButton label="Decline" variant="secondary" onPress={goBack} />
        </>
      ) : (
        <MotionButton label="Cancel challenge" variant="secondary" onPress={goBack} />
      )}
    </PlaceholderLayout>
  );
}
