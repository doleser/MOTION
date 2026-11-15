import {MotionButton} from '../../components/MotionButton';
import type {SearchScreenProps} from '../../navigation/types';
import {PlaceholderLayout} from './PlaceholderLayout';
import {FAKE_CHALLENGES} from './fakeChallenges';

/** PLACEHOLDER: received, sent, and upcoming challenges. */
export function ChallengesInboxScreen({navigation}: SearchScreenProps<'ChallengesInbox'>) {
  return (
    <PlaceholderLayout
      title="CHALLENGES"
      onBack={() => navigation.goBack()}
      note="Received, sent, and upcoming challenges will show here.">
      {FAKE_CHALLENGES.map((challenge) => (
        <MotionButton
          key={challenge.challengeId}
          label={`${challenge.label} (fake)`}
          variant="secondary"
          onPress={() =>
            navigation.navigate('ChallengeDetails', {challengeId: challenge.challengeId})
          }
        />
      ))}
    </PlaceholderLayout>
  );
}
