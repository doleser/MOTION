import {AppButton} from '../../components/AppButton';
import {Screen} from '../../components/Screen';
import type {AuthScreenProps} from '../../navigation/types';

export function PermissionsScreen({
  navigation,
}: AuthScreenProps<'Permissions'>) {
  // TODO: "Allow" should request location and notification permissions
  // (expo-location, expo-notifications). For now both buttons just move on.
  function goNext() {
    navigation.navigate('HomeCourt');
  }

  return (
    <Screen
      title="Location & notifications"
      subtitle="Location lets you check in at courts. Notifications tell you about challenges.">
      <AppButton label="Allow" onPress={goNext} />
      <AppButton label="Skip" variant="secondary" onPress={goNext} />
    </Screen>
  );
}
