import {NavigationContainer} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from './src/navigation/RootNavigator';
import {AuthProvider} from './src/services/AuthContext';

// Default export because index.ts (from the Expo template) imports it that way.
export default function App() {
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
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
