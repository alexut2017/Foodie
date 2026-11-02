import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../src/session';
import { C } from '../src/theme';

// Sends people to the right step of the inKind-style onboarding, or into the app.
export default function Gate() {
  const { ready, session, profileDone, onboarded } = useSession();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.linen }}><ActivityIndicator color={C.chili} /></View>;
  if (!session) return <Redirect href="/welcome" />;
  if (!profileDone) return <Redirect href="/profile" />;
  if (!onboarded) return <Redirect href="/location" />;
  return <Redirect href="/explore" />;
}
