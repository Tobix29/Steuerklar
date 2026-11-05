import { TabStack } from "~/components/TabStack";

export default function Layout() {
  return <TabStack title="Übersicht" screens={{ check: "Steuer-Check" }} />;
}
