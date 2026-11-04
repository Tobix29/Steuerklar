import "server-only";
import { z } from "zod";

const COMMON = new Set(["passwort1234", "password1234", "123456789012", "qwertzuiop12", "steuererklaerung", "hallohallo12"]);

export const EmailSchema = z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse eingeben.").max(254);
export const PasswordSchema = z
  .string()
  .min(12, "Das Passwort muss mindestens 12 Zeichen lang sein.")
  .max(128)
  .refine((p) => !COMMON.has(p.toLowerCase()), "Dieses Passwort ist zu häufig.")
  .refine((p) => new Set(p).size >= 6, "Das Passwort ist zu einfach.");
export const CredentialsSchema = z.object({ email: EmailSchema, password: z.string().min(1).max(128) });
export const RegisterSchema = z.object({ email: EmailSchema, password: PasswordSchema, acceptTerms: z.literal(true) });
export const CodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
