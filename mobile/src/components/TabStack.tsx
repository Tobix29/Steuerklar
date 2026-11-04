import { Platform } from "react-native";
import Stack from "expo-router/stack";
import { useColors } from "~/lib/theme";

/** Stack je Tab mit nativem großen Titel (iOS) und durchscheinendem Header. */
export function TabStack({ title, screens = {} }: { title: string; screens?: Record<string, string> }) {
  const c = useColors();
  const ios = Platform.OS === "ios";
  // Web dient nur als Vorschau: dort liegt die Tab-Leiste oben über dem Header → eigenen Titel im Inhalt anzeigen
  const web = Platform.OS === "web";
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerTransparent: ios,
        headerBlurEffect: ios ? "systemChromeMaterial" : undefined,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: c.bg },
        headerStyle: ios ? undefined : { backgroundColor: c.bg },
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.text },
        headerLargeTitleStyle: { color: c.text },
        contentStyle: { backgroundColor: c.bg, paddingTop: web ? 72 : 0 },
        headerShown: !web,
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
      {Object.entries(screens).map(([name, t]) => (
        <Stack.Screen key={name} name={name} options={{ title: t, headerLargeTitleEnabled: false }} />
      ))}
    </Stack>
  );
}
