import { TabStack } from "~/components/TabStack";

export default function Layout() {
  return <TabStack title="Mehr" screens={{ abgabe: "Abgeben lassen", finanzamt: "Finanzamt", buchhaltung: "Buchhaltung", fragen: "Fragen", konto: "Konto" }} />;
}
