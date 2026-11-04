import { Redirect } from "expo-router";
import { useSession } from "~/lib/session";

export default function Index() {
  const { status } = useSession();
  return <Redirect href={status === "signedIn" ? "/uebersicht" : "/anmelden"} />;
}
