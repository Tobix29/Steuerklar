import Stack from "expo-router/stack";
import { useColors } from "~/lib/theme";

export default function AuthLayout() {
  const c = useColors();
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: c.bg }, headerTintColor: c.accent, headerShadowVisible: false, headerStyle: { backgroundColor: c.bg }, headerTitleStyle: { color: c.text } }}>
      <Stack.Screen name="anmelden" options={{ headerShown: false }} />
      <Stack.Screen name="registrieren" options={{ title: "Konto erstellen", headerBackTitle: "Anmelden" }} />
    </Stack>
  );
}
