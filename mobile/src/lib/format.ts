const eurFmt = (digits: number) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const eur = (n: number, digits = 2) => eurFmt(digits).format(n);
export const pct = (n: number) => `${(n * 100).toLocaleString("de-AT", { maximumFractionDigits: 1 })} %`;

/** Parst deutsche Zahleneingaben ("1.234,56") robust. */
export function parseMoney(text: string): number {
  const clean = text.replace(/[^\d.,]/g, "");
  const n = Number(clean.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.min(Math.max(0, n), 10_000_000) : 0;
}

export const formatMoneyInput = (n: number) => (n ? n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

export function uid(): string {
  // crypto.randomUUID ist in Hermes verfügbar; Fallback für ältere Laufzeiten
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
