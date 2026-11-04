import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import Stack from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Loading, Notice, Screen } from "~/components/ui";
import { AppLockProvider } from "~/lib/appLock";
import { CaseProvider } from "~/lib/case";
import { API } from "~/lib/config";
import { SessionProvider, useSession } from "~/lib/session";

function Navigator() {
  const { status } = useSession();
  if (API.error)
    return (
      <Screen title="Konfiguration">
        <Notice tone="red" icon="⛔" text={API.error} />
      </Screen>
    );
  if (status === "loading") return <Loading />;
  const signedIn = status === "signedIn";

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="beleg/[id]" options={{ presentation: "modal", headerShown: true, title: "Beleg prüfen" }} />
      </Stack.Protected>
    </Stack>
  );

  return (
    <AppLockProvider active={signedIn}>
      {signedIn ? <CaseProvider>{stack}</CaseProvider> : stack}
    </AppLockProvider>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <SessionProvider>
          <Navigator />
        </SessionProvider>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
