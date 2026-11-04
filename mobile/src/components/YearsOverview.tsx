import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { Badge, Notice, Row, Section } from "~/components/ui";
import { api } from "~/lib/api";
import { useCase } from "~/lib/case";
import { eur } from "~/lib/format";
import { radius, useColors } from "~/lib/theme";
import { fristen, SUPPORTED_YEARS, type TaxYear } from "~/lib/types";

interface YearRow {
  year: TaxYear;
  hasData: boolean;
  documents: number;
  erstattung: number | null;
}

const fmtDate = (d: Date) => d.toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" });

/** Jahre, die noch beantragt werden können – neuestes zuerst. */
export const OPEN_YEARS: TaxYear[] = [...SUPPORTED_YEARS].reverse().filter((y) => !fristen(y).expired);

/** Kompakte Jahresauswahl als horizontale Chips. */
export function YearChips() {
  const c = useColors();
  const { year, setYear } = useCase();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {OPEN_YEARS.map((y) => {
        const f = fristen(y);
        const on = y === year;
        return (
          <Pressable
            key={y}
            onPress={() => setYear(y)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? c.accent : c.surface }}
          >
            <Text style={{ color: on ? c.onAccent : f.urgent ? c.orange : c.text, fontWeight: "600", fontSize: 15 }}>
              {y}
              {!f.yearEnded ? " · Prognose" : f.urgent ? " ⏳" : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Alle offenen Jahre mit Gutschrift und Frist; Fristwarnung für Jahre, die bald verfallen. */
export function YearsOverview() {
  const { year, setYear, result, documentCount } = useCase();
  const [rows, setRows] = useState<YearRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ years: YearRow[] }>("/api/years")
      .then((r) => alive && setRows(r.years))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [result?.erstattung, documentCount]);

  if (!rows) return null;
  const visible = rows.filter((r) => fristen(r.year).yearEnded && !fristen(r.year).expired).reverse();
  const urgent = visible.find((r) => fristen(r.year).urgent);
  const total = visible.reduce((a, r) => a + Math.max(0, r.erstattung ?? 0), 0);

  return (
    <>
      {urgent && (
        <Pressable onPress={() => setYear(urgent.year)} accessibilityRole="button" style={{ borderRadius: radius.md }}>
          <Notice
            tone="orange"
            icon="⏳"
            text={`Noch ${fristen(urgent.year).daysLeft} Tage für ${urgent.year}: Die Arbeitnehmerveranlagung ${urgent.year} ist nur noch bis ${fmtDate(fristen(urgent.year).antrag)} möglich.${urgent.year !== year ? ` Tippen, um ${urgent.year} zu öffnen.` : ""}`}
          />
        </Pressable>
      )}
      <Section
        title={total > 0 ? `Deine Jahre · insgesamt ${eur(total, 0)}` : "Deine Jahre"}
        footer="Die Arbeitnehmerveranlagung geht bis zu fünf Jahre rückwirkend – Geld, das du sonst verschenkst."
      >
        {visible.map((r) => {
          const f = fristen(r.year);
          return (
            <Row
              key={r.year}
              label={String(r.year)}
              strong={r.year === year}
              sublabel={`${r.hasData ? `${r.documents} Beleg${r.documents === 1 ? "" : "e"}` : "Noch nicht begonnen"} · Frist ${fmtDate(f.antrag)}`}
              value={r.erstattung !== null ? eur(r.erstattung, 0) : undefined}
              right={r.erstattung === null ? <Badge text={f.urgent ? "Frist läuft ab" : "Starten"} tone={f.urgent ? "orange" : "neutral"} /> : undefined}
              chevron
              onPress={() => setYear(r.year)}
            />
          );
        })}
      </Section>
    </>
  );
}
