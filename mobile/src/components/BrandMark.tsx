import { Text, View } from "react-native";
import { useColors } from "~/lib/theme";

export function BrandMark({ size = 64 }: { size?: number }) {
  const c = useColors();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
      <Text style={{ color: "#fff", fontSize: size * 0.5, fontWeight: "700" }}>✓</Text>
    </View>
  );
}
