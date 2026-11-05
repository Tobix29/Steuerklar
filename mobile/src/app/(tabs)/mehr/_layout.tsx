import { TabStack } from "~/components/TabStack";

export default function Layout() {
  return <TabStack title="Mehr" screens={{ abgabe: "Abgeben lassen", finanzamt: "Finanzamt", buchhaltung: "Buchhaltung", rechnungen: "Rechnungen", fragen: "Fragen", konto: "Konto" }} />;
}
