import React from 'react';
import { useOpenfort } from '../hooks/core/useOpenfort';

/**
 * Props for the AuthBoundary component
 */
export interface AuthBoundaryProps {
  /**
   * Component to render while the SDK is initializing and not ready
   */
  loading: React.ReactNode;
  
  /**
   * Component to render when the user is not authenticated
   */
  unauthenticated: React.ReactNode;
  
  /**
   * Optional component to render when there's an error during SDK initialization
   * Can be a component or a function that receives the error and returns a component
   */
  error?: React.ReactNode | ((error: Error) => React.ReactNode);
  
  /**
   * Children to render when the user is authenticated and the SDK is ready
   */
  children: React.ReactNode;
}

/**
 * Authentication boundary component that conditionally renders content based on
 * the user's authentication status and SDK readiness.
 * 
 * This component simplifies protecting routes and content based on authentication state.
 * It handles three main states:
 * 1. Loading - SDK is initializing
 * 2. Error - SDK encountered an initialization error
 * 3. Unauthenticated - User is not logged in
 * 4. Authenticated - User is logged in and SDK is ready
 * 
 * @example
 * ```tsx
 * import { AuthBoundary } from '@openfort/react-native';
 * import { Text, ActivityIndicator } from 'react-native';
 * 
 * function App() {
 *   return (
 *     <AuthBoundary
 *       loading={<ActivityIndicator size="large" />}
 *       unauthenticated={<LoginScreen />}
 *       error={(error) => <Text>Error: {error.message}</Text>}
 *     >
 *       <AuthenticatedApp />
 *     </AuthBoundary>
 *   );
 * }
 * ```
 * 
 * @example
 * // With React Navigation
 * ```tsx
 * import { AuthBoundary } from '@openfort/react-native';
 * import { NavigationContainer } from '@react-navigation/native';
 * import { createNativeStackNavigator } from '@react-navigation/native-stack';
 * 
 * const Stack = createNativeStackNavigator();
 * 
 * function App() {
 *   return (
 *     <NavigationContainer>
 *       <AuthBoundary
 *         loading={<SplashScreen />}
 *         unauthenticated={
 *           <Stack.Navigator>
 *             <Stack.Screen name="Login" component={LoginScreen} />
 *             <Stack.Screen name="Signup" component={SignupScreen} />
 *           </Stack.Navigator>
 *         }
 *       >
 *         <Stack.Navigator>
 *           <Stack.Screen name="Home" component={HomeScreen} />
 *           <Stack.Screen name="Profile" component={ProfileScreen} />
 *         </Stack.Navigator>
 *       </AuthBoundary>
 *     </NavigationContainer>
 *   );
 * }
 * ```
 */
export const AuthBoundary: React.FC<AuthBoundaryProps> = ({
  loading,
  unauthenticated,
  error: errorComponent,
  children,
}) => {
  const { user, isReady, error } = useOpenfort();

  // SDK encountered an error during initialization
  if (error && errorComponent) {
    if (typeof errorComponent === 'function') {
      return <>{errorComponent(error)}</>;
    }
    return <>{errorComponent}</>;
  }

  // SDK is still initializing
  if (!isReady) {
    return <>{loading}</>;
  }

  // User is not authenticated
  if (!user) {
    return <>{unauthenticated}</>;
  }

  // User is authenticated and SDK is ready
  return <>{children}</>;
};

export default AuthBoundary;