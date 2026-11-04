/**
 * Arbeitnehmerveranlagung Österreich (Einkünfte aus nichtselbständiger Arbeit).
 *
 * Abgedeckt: Lohnzettel (mehrere Dienstgeber), Werbungskosten inkl. Pauschale, Pendlerpauschale
 * und Pendlereuro (Aliquotierung), Telearbeitspauschale, ergonomisches Mobiliar, Sonderausgaben
 * (Kirchenbeitrag, Spenden, Steuerberatung), Krankheitskosten mit Selbstbehalt, Familienbonus Plus,
 * Alleinverdiener-/Alleinerzieherabsetzbetrag, Verkehrsabsetzbetrag inkl. Zuschlag,
 * SV-Rückerstattung, Kindermehrbetrag (vereinfacht), Steuer auf sonstige Bezüge (Jahressechstel).
 *
 * Nicht abgedeckt (→ Hinweis): Selbständige, Vermietung, Kapitalerträge, Pensionen,
 * Unterhaltsabsetzbetrag, Behinderung, doppelte Haushaltsführung, Verlustvorträge, Jahressechstel-Überschreitung.
 */
import { betrieb, vermietung, veranlagungsfreibetrag } from "./einkuenfte";
import { VERANLAGUNGSFREIBETRAG, AGB_PAUSCHALEN, BEHINDERUNG_PAUSCHBETRAG, SELBSTBEHALT, SONSTIGE_BEZUEGE, UNVERIFIED_GLOBAL, WK_KATEGORIEN, YEAR_PARAMS, type TaxYear, type YearParams } from "./constants";
import type { FormEntry, Line, TaxCase, TaxResult } from "./types";

const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: { amount: number }[]) => cents(xs.reduce((a, x) => a + x.amount, 0));
const eur = (n: number) => n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Tarifsteuer §33 Abs 1 EStG (stufenweise). */
export function tarifsteuer(einkommen: number, p: YearParams): number {
  let prev = 0;
  let tax = 0;
  const x = Math.max(0, einkommen);
  for (const b of p.brackets) {
    if (x <= prev) break;
    tax += (Math.min(x, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return cents(tax);
}

/** Steuer auf sonstige Bezüge innerhalb des Jahressechstels (§67 Abs 1). */
export function steuerSonstigeBezuege(betragNachSv: number): number {
  const x = Math.max(0, betragNachSv);
  if (x <= SONSTIGE_BEZUEGE.freigrenze) return 0;
  let rest = x;
  let tax = 0;
  for (const band of SONSTIGE_BEZUEGE.bands) {
    const part = Math.min(rest, band.size);
    tax += part * band.rate;
    rest -= part;
    if (rest <= 0) break;
  }
  // Teile über 83.333 € werden in der Praxis wie laufende Bezüge versteuert → Hinweis im Ergebnis
  return cents(tax);
}

/** Aliquotierung nach Fahrten pro Monat (§16 Abs 1 Z 6 lit e EStG). */
export function pendlerFaktor(fahrtenProMonat: number): number {
  if (fahrtenProMonat >= 11) return 1;
  if (fahrtenProMonat >= 8) return 2 / 3;
  if (fahrtenProMonat >= 4) return 1 / 3;
  return 0;
}

export function pendlerpauschale(km: number, zumutbar: boolean, fahrten: number, p: YearParams): number {
  const f = pendlerFaktor(fahrten);
  let full = 0;
  if (zumutbar) {
    if (km > 60) full = p.pendlerKlein.from60;
    else if (km > 40) full = p.pendlerKlein.from40;
    else if (km >= 20) full = p.pendlerKlein.from20;
  } else {
    if (km > 60) full = p.pendlerGross.from60;
    else if (km > 40) full = p.pendlerGross.from40;
    else if (km > 20) full = p.pendlerGross.from20;
    else if (km >= 2) full = p.pendlerGross.from2;
  }
  return cents(full * f * p.pendlerFaktor);
}

export function selbstbehalt(basis: number, reductionPoints: number): number {
  const tier = SELBSTBEHALT.find((s) => basis <= s.upTo)!;
  const rate = Math.max(0, tier.rate - reductionPoints / 100);
  return cents(Math.max(0, basis) * rate);
}

export function behinderungPauschbetrag(grad: number): number {
  return BEHINDERUNG_PAUSCHBETRAG.find((s) => grad >= s.from)?.amount ?? 0;
}

export function avabBetrag(kids: number, p: YearParams): number {
  if (kids <= 0) return 0;
  if (kids === 1) return p.avab.oneChild;
  return p.avab.twoChildren + (kids - 2) * p.avab.perFurtherChild;
}

/** Verkehrsabsetzbetrag inkl. Zuschlag (linear eingeschliffen). */
export function verkehrsabsetzbetrag(einkommen: number, p: YearParams): { vab: number; zuschlag: number } {
  const z = p.vabZuschlag;
  let zuschlag = 0;
  if (einkommen <= z.from) zuschlag = z.amount;
  else if (einkommen < z.to) zuschlag = cents((z.amount * (z.to - einkommen)) / (z.to - z.from));
  return { vab: p.vab, zuschlag };
}

export function calculate(input: TaxCase): TaxResult {
  const year = input.year as TaxYear;
  const p = YEAR_PARAMS[year];
  const lz = input.lohnzettel;
  const hinweise: string[] = [];
  const pflicht: string[] = [];
  const formular: FormEntry[] = [];
  const aktiv = lz.filter((x) => x.art !== "pension");
  const pensionen = lz.filter((x) => x.art === "pension");
  const hasEmployment = aktiv.length > 0;
  const hasPension = pensionen.length > 0;

  /* ---- Bezüge laut Lohnzettel ---- */
  // KZ 245 ist bereits um die vom Arbeitgeber berücksichtigte Pendlerpauschale (KZ 718) gekürzt.
  // In der Veranlagung wird die tatsächlich zustehende Pauschale angesetzt → KZ 718 zurückrechnen.
  const laufend = cents(lz.reduce((a, x) => a + x.kz245 + x.kz718, 0));
  const sonstige = cents(lz.reduce((a, x) => a + Math.max(0, x.kz220 - x.kz225), 0));
  const steuerSonst = steuerSonstigeBezuege(sonstige);
  if (sonstige > 83_333) hinweise.push("Sonstige Bezüge über 83.333 € werden wie laufende Bezüge besteuert – dies ist hier vereinfacht.");
  const sv = cents(lz.reduce((a, x) => a + x.kz230 + x.kz225, 0));

  /* ---- Werbungskosten ---- */
  const wk: Line[] = [];
  const pp = hasEmployment ? pendlerpauschale(input.pendlerKm, input.oeffiZumutbar, input.fahrtenProMonat, p) : 0;
  const pendlerAnspruch = pp > 0;
  if (pendlerAnspruch) {
    wk.push({
      label: `${input.oeffiZumutbar ? "Kleines" : "Großes"} Pendlerpauschale (${Math.round(input.pendlerKm)} km)`,
      amount: pp,
      kz: "718",
      hint: pendlerFaktor(input.fahrtenProMonat) < 1 ? "anteilig wegen weniger Fahrten pro Monat" : p.pendlerFaktor > 1 ? "inkl. befristeter Erhöhung (Mai 2022 – Juni 2023)" : undefined,
    });
    formular.push({ formular: "L1", kz: "718", label: "Pendlerpauschale – tatsächlich zustehender Jahresbetrag", value: `€ ${eur(pp)}` });
  } else if (input.pendlerKm > 0 && input.fahrtenProMonat >= 4) {
    hinweise.push(input.oeffiZumutbar ? "Kein Pendlerpauschale: Bei zumutbaren Öffis erst ab 20 km." : "Kein Pendlerpauschale: Erst ab 2 km Arbeitsweg.");
  }

  const teleTage = Math.min(input.telearbeitstage, p.telearbeit.maxDays);
  const teleDiff = cents(Math.max(0, teleTage * p.telearbeit.perDay - input.telearbeitspauschaleArbeitgeber));
  if (teleDiff > 0) wk.push({ label: `Telearbeitspauschale (${teleTage} Tage × ${p.telearbeit.perDay} € abzgl. Arbeitgeber)`, amount: teleDiff, hint: "wird bei korrekt gemeldeten Tagen am Lohnzettel automatisch berücksichtigt" });
  const mob = Math.min(input.mobiliar, p.mobiliarMax);
  if (mob > 0) {
    if (input.telearbeitstage < 26) hinweise.push("Ergonomisches Mobiliar ist erst ab 26 Telearbeitstagen absetzbar.");
    else {
      wk.push({ label: "Ergonomisch geeignetes Mobiliar", amount: cents(mob), kz: "158", hint: input.mobiliar > p.mobiliarMax ? `max. ${p.mobiliarMax} € pro Jahr` : undefined });
      formular.push({ formular: "L1", kz: "158", label: "Ergonomisch geeignetes Mobiliar", value: `€ ${eur(mob)}` });
    }
  }
  // Pendler, Telearbeit und Mobiliar werden ohne Anrechnung auf die Werbungskostenpauschale berücksichtigt.
  const ohneAnrechnung = sum(wk);

  const kzLabels: Record<string, string> = Object.fromEntries(Object.values(WK_KATEGORIEN).map((c) => [c.kz, c.label]));
  kzLabels["723"] = "Doppelte Haushaltsführung";
  kzLabels["300"] = "Familienheimfahrten";
  const byKz = new Map<string, number>();
  for (const w of input.werbungskosten) {
    const cat = WK_KATEGORIEN[w.category ?? "sonstige"];
    byKz.set(cat.kz, cents((byKz.get(cat.kz) ?? 0) + w.amount));
  }
  if (input.doppelteHaushaltsfuehrung > 0) byKz.set("723", cents(input.doppelteHaushaltsfuehrung));
  if (input.familienheimfahrten > 0) {
    const cap = p.pendlerGross.from60;
    byKz.set("300", cents(Math.min(input.familienheimfahrten, cap)));
    if (input.familienheimfahrten > cap) hinweise.push(`Familienheimfahrten sind mit dem höchsten Pendlerpauschale (${eur(cap)} €) gedeckelt.`);
  }
  const sonstigeWk = cents([...byKz.values()].reduce((a, b) => a + b, 0));
  const pauschale = hasEmployment ? p.werbungskostenpauschale : 0;
  if (sonstigeWk > pauschale) {
    for (const [kz, amount] of byKz) {
      const label = kzLabels[kz] ?? "Werbungskosten";
      wk.push({ label, amount, kz });
      formular.push({ formular: "L1", kz, label, value: `€ ${eur(amount)}` });
    }
  } else if (pauschale > 0) {
    wk.push({ label: "Werbungskostenpauschale", amount: pauschale, hint: sonstigeWk > 0 ? `deine Ausgaben (${eur(sonstigeWk)} €) liegen darunter` : "automatisch berücksichtigt" });
  }
  const wkSumme = cents(ohneAnrechnung + Math.max(sonstigeWk, pauschale));
  const einkuenfte = cents(laufend - wkSumme);

  /* ---- Weitere Einkünfte: Vermietung (E1b), Selbständig/Gewerbe (E1a) ---- */
  const weitere: Line[] = [];
  let vvSumme = 0;
  for (const o of input.mietobjekte) {
    const r = vermietung(o, year);
    vvSumme += r.ergebnis;
    weitere.push(...r.lines, { label: `Einkünfte aus Vermietung ${o.bezeichnung || ""}`.trim(), amount: r.ergebnis });
  }
  vvSumme = cents(vvSumme);
  let betriebSumme = 0;
  for (const b of input.betriebe) {
    const r = betrieb(b, p);
    betriebSumme += r.gewinn;
    hinweise.push(...r.hinweise);
    weitere.push(...r.lines, { label: `Einkünfte aus ${b.art === "gewerbe" ? "Gewerbebetrieb" : "selbständiger Arbeit"}`, amount: r.gewinn });
  }
  betriebSumme = cents(betriebSumme);
  if (input.mietobjekte.length) formular.push({ formular: "E1b", kz: "—", label: "Beilage E1b je Objekt (Einnahmen, AfA, Werbungskosten)", value: `€ ${eur(vvSumme)}` });
  if (input.betriebe.length) formular.push({ formular: "E1a", kz: "—", label: "Beilage E1a je Betrieb (Gewinnermittlung)", value: `€ ${eur(betriebSumme)}` });
  const neben = cents(vvSumme + betriebSumme);
  const vfb = hasEmployment || hasPension ? veranlagungsfreibetrag(neben, VERANLAGUNGSFREIBETRAG) : 0;
  if (vfb > 0) hinweise.push(`Deine Nebeneinkünfte (${eur(neben)} €) sind ${vfb >= neben ? "zur Gänze" : "teilweise"} steuerfrei (Veranlagungsfreibetrag bis 730 €).`);
  const gde = cents(einkuenfte + neben - vfb);
  const e1 = input.mietobjekte.length > 0 || input.betriebe.length > 0;
  if (neben > VERANLAGUNGSFREIBETRAG && (hasEmployment || hasPension))
    pflicht.push("Nebeneinkünfte über 730 € – du musst eine Einkommensteuererklärung (E1) abgeben (Frist: 30. April, elektronisch 30. Juni des Folgejahres).");
  if (e1)
    hinweise.push("Mit Vermietung oder selbständigen Einkünften gibst du statt L1 die Einkommensteuererklärung E1 ab. Werbungskosten, Sonderausgaben und Familienbonus trägst du dort ein – die Kennzahlen können vom L1 abweichen.");
  if (e1 && !hasEmployment && !hasPension && neben > 0)
    pflicht.push("Ohne Lohnzettel besteht ab einem Einkommen über der Steuergrenze die Pflicht zur Einkommensteuererklärung (E1).");

  /* ---- Sonderausgaben ---- */
  const sa: Line[] = [];
  if (input.kirchenbeitrag > 0) {
    sa.push({ label: "Kirchenbeitrag", amount: Math.min(input.kirchenbeitrag, p.kirchenbeitragMax), hint: input.kirchenbeitrag > p.kirchenbeitragMax ? `max. ${p.kirchenbeitragMax} €` : "wird von der Kirche automatisch übermittelt" });
  }
  const spenden = sum(input.spenden);
  if (spenden > 0) {
    const cap = cents(Math.max(0, gde) * 0.1);
    sa.push({ label: "Spenden", amount: Math.min(spenden, cap), hint: spenden > cap ? "max. 10 % des Gesamtbetrags der Einkünfte" : "wird von der Organisation automatisch übermittelt" });
  }
  const stb = sum(input.steuerberatung);
  if (stb > 0) {
    sa.push({ label: "Steuerberatungskosten", amount: stb, kz: "460" });
    formular.push({ formular: "L1", kz: "460", label: "Steuerberatungskosten", value: `€ ${eur(stb)}` });
  }
  // Verlustvortrag: max. 75 % des Gesamtbetrags der Einkünfte (Verlustvortragsgrenze)
  if (input.verlustvortrag > 0) {
    const cap = cents(Math.max(0, gde - sum(sa)) * 0.75);
    const abzug = cents(Math.min(input.verlustvortrag, cap));
    if (abzug > 0) {
      sa.push({ label: "Verlustvortrag aus Vorjahren", amount: abzug, hint: abzug < input.verlustvortrag ? `max. 75 % – Rest ${eur(input.verlustvortrag - abzug)} € bleibt für Folgejahre` : undefined });
      formular.push({ formular: "E1", kz: "—", label: "Verlustabzug (Verlustvortrag) eintragen", value: `€ ${eur(abzug)}` });
    }
  }
  if (gde < 0 && betriebSumme < 0)
    hinweise.push(`Dein betrieblicher Verlust kann nicht ganz ausgeglichen werden – bis zu ${eur(Math.min(-gde, -betriebSumme))} € kannst du in den Folgejahren als Verlustvortrag abziehen.`);
  const saSumme = sum(sa);
  const einkommenVorAgb = cents(gde - saSumme);

  /* ---- Außergewöhnliche Belastungen ---- */
  const kids = input.children.filter((c) => c.months > 0);
  const avabBerechtigt =
    kids.length > 0 &&
    (input.familienstatus === "alleinerzieher" || (input.familienstatus === "alleinverdiener" && input.partnerEinkuenfte <= p.avabPartnerIncomeLimit));
  if (input.familienstatus === "alleinverdiener" && input.partnerEinkuenfte > p.avabPartnerIncomeLimit)
    hinweise.push(`Kein Alleinverdienerabsetzbetrag: Die Einkünfte deiner Partnerin/deines Partners übersteigen ${eur(p.avabPartnerIncomeLimit)} €.`);

  const agb: Line[] = [];
  const krank = sum(input.krankheitskosten);
  if (krank > 0) {
    const sb = selbstbehalt(einkommenVorAgb + sonstige, (avabBerechtigt ? 1 : 0) + kids.length);
    const abziehbar = cents(Math.max(0, krank - sb));
    agb.push({ label: "Krankheitskosten nach Selbstbehalt", amount: abziehbar, kz: "730", hint: `Selbstbehalt: ${eur(sb)} €` });
    formular.push({ formular: "L1", kz: "730", label: "Krankheitskosten (vor Selbstbehalt)", value: `€ ${eur(krank)}` });
    if (abziehbar === 0) hinweise.push("Deine Krankheitskosten liegen unter dem Selbstbehalt und wirken sich nicht aus.");
  }
  // Ohne Selbstbehalt: Behinderung (§35) und auswärtige Berufsausbildung (§34 Abs 8)
  const pb = behinderungPauschbetrag(input.behinderungGrad);
  if (pb > 0) {
    agb.push({ label: `Pauschbetrag Behinderung (${input.behinderungGrad} %)`, amount: pb, hint: "ohne Selbstbehalt" });
    formular.push({ formular: "L1", kz: "—", label: "Behinderung: Grad der Behinderung eintragen (Pauschbetrag wird automatisch angesetzt)", value: `${input.behinderungGrad} %` });
  } else if (input.behinderungGrad > 0) hinweise.push("Ein Pauschbetrag für Behinderung steht erst ab einem Grad von 25 % zu.");
  if (input.behinderungKfz) {
    if (input.behinderungGrad < 50) hinweise.push("Der Kfz-Freibetrag setzt eine Gehbehinderung (Ausweis/Eintrag „Unzumutbarkeit öffentlicher Verkehrsmittel“) voraus – bitte prüfen.");
    const kfz = AGB_PAUSCHALEN.kfzBehinderungMonat * 12;
    agb.push({ label: "Freibetrag eigenes Kfz (Gehbehinderung)", amount: kfz, hint: `${AGB_PAUSCHALEN.kfzBehinderungMonat} € pro Monat, ohne Selbstbehalt` });
    formular.push({ formular: "L1", kz: "—", label: "Behinderung: Freibetrag für ein eigenes Kfz beantragen", value: "ja" });
  }
  const ausbildung = input.children.reduce((a, c) => a + c.auswaertigeAusbildungMonate, 0);
  if (ausbildung > 0) {
    const amount = ausbildung * AGB_PAUSCHALEN.auswaertigeAusbildungMonat;
    agb.push({ label: "Auswärtige Berufsausbildung (Kinder)", amount, hint: `${ausbildung} Monate × ${AGB_PAUSCHALEN.auswaertigeAusbildungMonat} €` });
    formular.push({ formular: "L1k", kz: "—", label: "Auswärtige Berufsausbildung beantragen", value: `${ausbildung} Monate` });
  }
  const agbSumme = sum(agb);
  const einkommen = Math.max(0, cents(einkommenVorAgb - agbSumme));

  /* ---- Tarif und Absetzbeträge (als Funktion, damit die Kapitalertrags-Option verglichen werden kann) ---- */
  const svPension = cents(pensionen.reduce((a, x) => a + x.kz230 + x.kz225, 0));
  const pensionsEinkuenfte = cents(pensionen.reduce((a, x) => a + x.kz245, 0));
  const pabErhoeht = hasPension && input.pensionErhoeht && input.partnerEinkuenfte <= p.pension.partnerLimit && !avabBerechtigt;
  if (hasPension && input.pensionErhoeht && !pabErhoeht)
    hinweise.push(`Kein erhöhter Pensionistenabsetzbetrag: Partnereinkünfte über ${eur(p.pension.partnerLimit)} € oder Anspruch auf Alleinverdienerabsetzbetrag.`);

  function steuerAus(eink: number, collect: boolean) {
    const tarif = tarifsteuer(eink, p);
    const abs: Line[] = [];
    const neg: Line[] = [];
    const form: FormEntry[] = [];

    let fb = 0;
    for (const c of kids) {
      const age = year - c.birthYear;
      const full = age < 18 ? p.familienbonus.under18 : p.familienbonus.over18;
      fb += full * (c.months / 12) * c.familienbonusShare;
    }
    fb = cents(fb);
    const fbWirksam = Math.min(fb, tarif);
    if (fb > 0) {
      abs.push({ label: "Familienbonus Plus", amount: fbWirksam, hint: fbWirksam < fb ? `Anspruch ${eur(fb)} € – kann die Steuer nur bis 0 senken` : undefined });
      form.push({ formular: "L1k", kz: "—", label: "Familienbonus Plus beantragen (je Kind ein L1k)", value: kids.map((k) => `${k.firstName || "Kind"}: ${k.familienbonusShare === 1 ? "ganz" : "Hälfte"}`).join(", ") });
    }
    let steuer = cents(tarif - fbWirksam);

    const { vab, zuschlag } = hasEmployment ? verkehrsabsetzbetrag(eink, p) : { vab: 0, zuschlag: 0 };
    const pendlereuro = pendlerAnspruch ? cents(input.pendlerKm * p.pendlereuroPerKm * pendlerFaktor(input.fahrtenProMonat)) : 0;
    if (vab > 0) abs.push({ label: "Verkehrsabsetzbetrag", amount: vab });
    if (zuschlag > 0) abs.push({ label: "Zuschlag zum Verkehrsabsetzbetrag", amount: zuschlag, hint: "für niedrige Einkommen" });
    if (pendlereuro > 0) {
      abs.push({ label: `Pendlereuro (${Math.round(input.pendlerKm)} km × ${p.pendlereuroPerKm} €)`, amount: pendlereuro, kz: "916" });
      form.push({ formular: "L1", kz: "916", label: "Pendlereuro – zustehender Jahresbetrag", value: `€ ${eur(pendlereuro)}` });
    }

    // Unterhaltsabsetzbetrag (§33 Abs 4 Z 3): je Kind und Monat, wirkt nur bis 0
    let uab = 0;
    input.unterhaltKinder.forEach((k, i) => {
      uab += k.months * p.uab[Math.min(i, 2)]!;
    });
    uab = cents(uab);
    if (uab > 0) {
      abs.push({ label: "Unterhaltsabsetzbetrag", amount: uab, hint: `${input.unterhaltKinder.length} Kind(er)` });
      form.push({ formular: "L1", kz: "—", label: "Unterhaltsabsetzbetrag beantragen (Beilage L1k)", value: `€ ${eur(uab)}` });
    }

    // Pensionistenabsetzbetrag (§33 Abs 6), linear eingeschliffen
    let pab = 0;
    if (hasPension) {
      const full = pabErhoeht ? p.pension.pabErhoeht : p.pension.pab;
      const from = pabErhoeht ? p.pension.fromErhoeht : p.pension.from;
      pab = pensionsEinkuenfte <= from ? full : pensionsEinkuenfte >= p.pension.to ? 0 : cents((full * (p.pension.to - pensionsEinkuenfte)) / (p.pension.to - from));
      if (pab > 0) abs.push({ label: pabErhoeht ? "Erhöhter Pensionistenabsetzbetrag" : "Pensionistenabsetzbetrag", amount: pab });
      if (pabErhoeht) form.push({ formular: "L1", kz: "—", label: "Erhöhten Pensionistenabsetzbetrag beantragen", value: "ja" });
    }

    // Teuerungsabsetzbetrag 2022 (Zuschlag zu VAB bzw. PAB), linear eingeschliffen
    let teuerung = 0;
    if (p.teuerung && (hasEmployment || hasPension)) {
      const t = p.teuerung;
      const [basisT, from, to] = hasEmployment ? [eink, t.from, t.to] : [pensionsEinkuenfte, t.pensionFrom, t.pensionTo];
      teuerung = basisT <= from ? t.amount : basisT >= to ? 0 : cents((t.amount * (to - basisT)) / (to - from));
      if (teuerung > 0) abs.push({ label: "Teuerungsabsetzbetrag 2022", amount: teuerung, hint: "für niedrige Einkommen" });
    }

    // Pendlereuro und Unterhaltsabsetzbetrag wirken nur bis 0; VAB/Zuschlag/PAB/Teuerung können über die SV-Rückerstattung zu einer Gutschrift führen.
    steuer = cents(Math.max(0, steuer - pendlereuro - uab) - vab - zuschlag - pab - teuerung);
    if (steuer < 0) {
      let svRe = 0;
      if (hasEmployment) {
        const cap = (pendlerAnspruch ? p.svRueckerstattung.maxPendler : p.svRueckerstattung.max) + (p.svRueckerstattung.inklZuschlag ? 0 : zuschlag);
        svRe = cents(Math.min(-steuer, sv * p.svRueckerstattung.rate, cap));
        if (svRe > 0) neg.push({ label: "SV-Rückerstattung", amount: svRe, hint: `${p.svRueckerstattung.rate * 100} % der SV-Beiträge` });
      } else if (hasPension) {
        svRe = cents(Math.min(-steuer, svPension * p.pension.svRate, p.pension.svMax));
        if (svRe > 0) neg.push({ label: "SV-Rückerstattung für Pensionist:innen", amount: svRe, hint: `${Math.round(p.pension.svRate * 100)} % der Beiträge, max. ${eur(p.pension.svMax)} €` });
      }
      steuer = -svRe;
    }

    if (avabBerechtigt) {
      const a = avabBetrag(kids.length, p);
      neg.push({ label: input.familienstatus === "alleinerzieher" ? "Alleinerzieherabsetzbetrag" : "Alleinverdienerabsetzbetrag", amount: a, hint: "wird auch ohne Steuerschuld ausbezahlt" });
      form.push({ formular: "L1", kz: "—", label: input.familienstatus === "alleinerzieher" ? "Alleinerzieherabsetzbetrag beantragen" : "Alleinverdienerabsetzbetrag beantragen", value: `${kids.length} Kind(er)` });
      steuer = cents(steuer - a);
    }

    // Kindermehrbetrag (vereinfacht): Differenz zwischen dem Betrag je Kind und der Steuer vor Familienbonus
    if (kids.length > 0 && (avabBerechtigt || hasEmployment || hasPension)) {
      const kmb = cents(Math.max(0, p.kindermehrbetrag * kids.length - tarif));
      if (kmb > 0) {
        neg.push({ label: "Kindermehrbetrag", amount: kmb, hint: "vereinfachte Berechnung" });
        steuer = cents(steuer - kmb);
      }
    }
    if (collect) formular.push(...form);
    return { tarif, steuer, abs, neg };
  }

  const basis = steuerAus(einkommen, true);
  const { tarif, abs, neg } = basis;
  const steuer = basis.steuer;

  /* ---- Kapitalerträge: Regelbesteuerungsoption (§27a Abs 5) ---- */
  const k = input.kapital;
  const kapitalSumme = cents(k.ertraege275 + k.ertraege25);
  let kapitalErstattung = 0;
  let kapitalOption: TaxResult["kapitalOption"] = null;
  if (kapitalSumme > 0) {
    const regel = steuerAus(einkommen + kapitalSumme, false);
    const mehrsteuer = cents(regel.steuer - steuer);
    const erst = cents(k.kestBezahlt - mehrsteuer);
    const empfohlen = erst >= 1;
    kapitalOption = { empfohlen, erstattung: empfohlen ? erst : 0, mehrsteuer };
    if (empfohlen) {
      kapitalErstattung = erst;
      neg.push({ label: "KESt-Gutschrift (Regelbesteuerungsoption)", amount: erst, hint: `KESt ${eur(k.kestBezahlt)} € − Steuer nach Tarif ${eur(Math.max(0, mehrsteuer))} €` });
      formular.push({ formular: "E1kv", kz: "—", label: "Regelbesteuerungsoption für Kapitalerträge ausüben (Erklärung E1 mit Beilage E1kv statt L1)", value: `€ ${eur(kapitalSumme)} Erträge` });
      hinweise.push("Die Regelbesteuerungsoption gilt für alle Kapitalerträge mit Sondersteuersatz. Vermittelst du jemandem den Alleinverdienerabsetzbetrag, kann die Erstattung entfallen.");
    } else {
      hinweise.push("Die Regelbesteuerungsoption für Kapitalerträge lohnt sich bei dir nicht – dein Steuersatz liegt über dem KESt-Satz.");
    }
  }

  const est = cents(steuer + steuerSonst);
  const lst = cents(lz.reduce((a, x) => a + x.kz260, 0));
  const erstattung = cents(lst - est + kapitalErstattung);

  /* ---- Steuersätze ---- */
  const grenz = einkommen > 0 ? (tarifsteuer(einkommen + 100, p) - tarifsteuer(einkommen, p)) / 100 : 0;
  const brutto = lz.reduce((a, x) => a + x.kz210, 0);

  /* ---- Hinweise & Pflichtveranlagung (§41 EStG) ---- */
  if (p.unverified.length) hinweise.push(`Einige Parameter für ${year} sind noch nicht amtlich verifiziert – das Ergebnis ist eine Prognose.`);
  if (lz.length > 1) pflicht.push("Mehrere Lohnzettel im selben Zeitraum – die Arbeitnehmerveranlagung ist dann meist verpflichtend (Frist: 30. September des Folgejahres).");
  if (lz.some((x) => x.kz718 > 0) && Math.abs(lz.reduce((a, x) => a + x.kz718, 0) - pp) > 1)
    pflicht.push("Die vom Arbeitgeber berücksichtigte Pendlerpauschale weicht vom zustehenden Betrag ab – bei zu hohem Betrag besteht Pflicht zur Veranlagung.");
  if (!hasEmployment && !hasPension && !e1) hinweise.push("Lade deinen Lohnzettel (L16) hoch – du findest ihn in FinanzOnline unter „Abfragen“.");
  if (input.spenden.length || input.kirchenbeitrag > 0) hinweise.push("Spenden und Kirchenbeitrag werden automatisch an das Finanzamt übermittelt – bitte nicht zusätzlich eintragen.");
  if (erstattung > 0 && pflicht.length === 0 && hasEmployment)
    hinweise.push("Gibst du keine Erklärung ab, kann die antragslose Arbeitnehmerveranlagung greifen – Werbungskosten und Familienbonus werden dann aber nicht berücksichtigt.");

  return {
    year,
    provisional: p.unverified.length > 0,
    unverified: [...p.unverified, ...UNVERIFIED_GLOBAL],
    laufendeBezuege: laufend,
    sonstigeBezuege: sonstige,
    steuerSonstigeBezuege: steuerSonst,
    werbungskosten: wk,
    werbungskostenSumme: wkSumme,
    einkuenfte,
    weitereEinkuenfte: weitere,
    veranlagungsfreibetrag: vfb,
    gesamtbetragDerEinkuenfte: gde,
    e1Erforderlich: e1,
    sonderausgaben: sa,
    sonderausgabenSumme: saSumme,
    aussergewoehnlicheBelastungen: agb,
    aussergewoehnlicheBelastungenSumme: agbSumme,
    einkommen,
    tarifsteuer: tarif,
    absetzbetraege: abs,
    negativsteuer: neg,
    einkommensteuer: est,
    anrechenbareLohnsteuer: lst,
    erstattung,
    grenzsteuersatz: Math.round(grenz * 1000) / 1000,
    durchschnittssteuersatz: brutto > 0 ? Math.round((Math.max(0, est) / brutto) * 1000) / 1000 : 0,
    formular,
    kapitalOption,
    hinweise,
    pflichtveranlagung: pflicht,
  };
}
