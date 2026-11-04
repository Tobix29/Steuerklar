import { Platform, useColorScheme } from "react-native";

const light = {
  bg: "#f2f2f7",
  surface: "#ffffff",
  surface2: "#f2f2f7",
  text: "#1d1d1f",
  text2: "#3c3c43",
  muted: "#8e8e93",
  hairline: "rgba(60,60,67,0.18)",
  accent: "#0071e3",
  accentSoft: "rgba(0,113,227,0.12)",
  green: "#1d9a4d",
  greenSoft: "rgba(52,199,89,0.15)",
  red: "#e5352b",
  redSoft: "rgba(255,59,48,0.12)",
  orange: "#c76a00",
  orangeSoft: "rgba(255,149,0,0.15)",
  onAccent: "#ffffff",
};

const dark: typeof light = {
  bg: "#000000",
  surface: "#1c1c1e",
  surface2: "#2c2c2e",
  text: "#f5f5f7",
  text2: "#d2d2d7",
  muted: "#98989d",
  hairline: "rgba(84,84,88,0.6)",
  accent: "#2997ff",
  accentSoft: "rgba(41,151,255,0.18)",
  green: "#30d158",
  greenSoft: "rgba(48,209,88,0.18)",
  red: "#ff453a",
  redSoft: "rgba(255,69,58,0.18)",
  orange: "#ff9f0a",
  orangeSoft: "rgba(255,159,10,0.18)",
  onAccent: "#ffffff",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const font = {
  family: Platform.select({ ios: "System", android: "sans-serif", default: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif" }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, Menlo, monospace" }),
};

export const radius = { sm: 10, md: 12, lg: 18, xl: 26 };
