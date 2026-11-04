import { NativeTabs } from "expo-router/native-tabs";
import { useColors } from "~/lib/theme";

export default function TabsLayout() {
  const c = useColors();
  return (
    <NativeTabs tintColor={c.accent}>
      <NativeTabs.Trigger name="uebersicht">
        <NativeTabs.Trigger.Label>Übersicht</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Label>Über dich</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="belege">
        <NativeTabs.Trigger.Label>Belege</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.viewfinder" md="document_scanner" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ergebnis">
        <NativeTabs.Trigger.Label>Ergebnis</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fragen">
        <NativeTabs.Trigger.Label>Fragen</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }} md="chat" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="konto">
        <NativeTabs.Trigger.Label>Konto</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
