import {Anton_400Regular} from '@expo-google-fonts/anton';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {NavigationContainer} from '@react-navigation/native';
import {useFonts} from 'expo-font';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {FullScreenSpinner} from './src/components/FullScreenSpinner';
import {RootNavigator} from './src/navigation/RootNavigator';
import {AuthProvider} from './src/services/AuthContext';

// Default export because index.ts (from the Expo template) imports it that way.
export default function App() {
  // The Figma fonts. The keys are the names used in src/theme/typography.ts.
  const [fontsLoaded, fontError] = useFonts({
    Anton_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Wait for the fonts so text doesn't flash in the wrong font. If they fail
  // to load, carry on with the system font rather than getting stuck.
  if (!fontsLoaded && !fontError) {
    return <FullScreenSpinner />;
  }

  return (
    // Measures the notch and home-bar areas so screens can avoid them.
    <SafeAreaProvider>
      {/* Who is signed in, and their profile. */}
      <AuthProvider>
        {/* React Navigation's required outer wrapper. */}
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
      {/* Dark clock and battery by default. The dark auth screens switch it
          to light while they're showing. */}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
