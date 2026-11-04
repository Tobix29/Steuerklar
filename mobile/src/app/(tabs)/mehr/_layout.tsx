import { TabStack } from "~/components/TabStack";

export default function Layout() {
  return <TabStack title="Mehr" screens={{ finanzamt: "Finanzamt", fragen: "Fragen", konto: "Konto" }} />;
}
