import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Registrieren" };

export default function Page() {
  return <RegisterForm />;
}
