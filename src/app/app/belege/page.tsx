"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MoneyInput, NumberInput, useToast } from "@/components/ui";
import { api, eur } from "@/lib/client/api";
import { DOCUMENT_TYPES, type DocumentType, type Extraction, type LohnzettelFields } from "@/lib/ai/schema";
import { WK_KATEGORIEN, type WkKategorie } from "@/lib/tax/constants";
import { belegAmount } from "@/lib/tax/apply";
import type { StoredDocument } from "@/lib/server/repo";
import { useCase } from "../CaseContext";
import { BankImport } from "./BankImport";
import { downscale } from "@/lib/client/image";

const LZ_FIELDS: [keyof LohnzettelFields, string, string][] = [
  ["kz210", "Bruttobezüge", "210"],
  ["kz215", "Steuerfreie Bezüge", "215"],
  ["kz220", "Sonstige Bezüge (13./14.)", "220"],
  ["kz225", "SV-Beiträge sonstige Bezüge", "225"],
  ["kz230", "SV-Beiträge laufende Bezüge", "230"],
  ["kz245", "Steuerpflichtige Bezüge", "245"],
  ["kz260", "Einbehaltene Lohnsteuer", "260"],
  ["kz717", "Gewerkschaftsbeiträge", "717"],
  ["kz718", "Pendlerpauschale (Arbeitgeber)", "718"],
  ["kz916", "Pendlereuro (Arbeitgeber)", "916"],
  ["telearbeitspauschale", "Telearbeitspauschale (Arbeitgeber)", "–"],
];

const emptyLz = (): LohnzettelFields => ({
  arbeitgeber: null, istPension: null, kz210: null, kz215: null, kz220: null, kz225: null, kz230: null, kz245: null, kz260: null,
  kz717: null, kz718: null, kz916: null, telearbeitstage: null, telearbeitspauschale: null,
});

interface Upload { key: string; name: string; preview: string | null; status: "uploading" | "error"; error?: string }

export default function Belege() {
  const { year, data, reload } = useCase();
  const [docs, setDocs] = useState<StoredDocument[] | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await api<{ documents: StoredDocument[]; aiEnabled: boolean }>(`/api/documents?year=${year}`);
    setDocs(r.documents);
    setAiEnabled(r.aiEnabled);
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFiles(files: FileList | File[]) {
    for (const file of Array.from(files).slice(0, 20)) {
      const key = crypto.randomUUID();
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setUploads((u) => [...u, { key, name: file.name, preview, status: "uploading" }]);
      try {
        const fd = new FormData();
        fd.append("file", await downscale(file));
        fd.append("year", String(year));
        const r = await api<{ document: StoredDocument }>("/api/documents", { method: "POST", body: fd });
        setUploads((u) => u.filter((x) => x.key !== key));
        if (preview) setPreviews((p) => ({ ...p, [r.document.id]: preview }));
        setDocs((d) => [r.document, ...(d ?? [])]);
        setOpen(r.document.id);
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: "error", error: e instanceof Error ? e.message : "Fehler" } : x)));
      }
    }
  }

  async function patch(doc: StoredDocument, body: Partial<Pick<StoredDocument, "extraction" | "applied">>) {
    try {
      const r = await api<{ document: StoredDocument }>(`/api/documents/${doc.id}`, { method: "PATCH", json: body });
      setDocs((d) => d?.map((x) => (x.id === doc.id ? r.document : x)) ?? null);
      await reload();
      if (body.applied === true) {
        toast.show("✓ In die Arbeitnehmerveranlagung übernommen");
        setOpen(null);
      }
      if (body.applied === false) toast.show("Übernahme zurückgenommen");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function remove(doc: StoredDocument) {
    if (!confirm("Beleg und alle daraus übernommenen Werte löschen?")) return;
    await api(`/api/documents/${doc.id}`, { method: "DELETE" });
    setDocs((d) => d?.filter((x) => x.id !== doc.id) ?? null);
    await reload();
    toast.show("Beleg gelöscht");
  }

  const pendingCount = docs?.filter((d) => !d.applied).length ?? 0;

  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Schritt 2</p>
          <h1 className="title">Belege</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Lohnzettel (PDF aus FinanzOnline) und Rechnungen hochladen oder fotografieren. Die KI erkennt alles, du bestätigst.</p>
        </div>
      </header>

      {!aiEnabled && (
        <div className="notice notice-orange small">
          <span>🧪</span>
          <span><strong>Demo-Modus:</strong> Es ist kein KI-Schlüssel hinterlegt. Hochgeladene Belege liefern Beispielwerte eines Lohnzettels.</span>
        </div>
      )}

      <div
        className={`dropzone${drag ? " drag" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void uploadFiles(e.dataTransfer.files); }}
      >
        <div className="icon" aria-hidden="true">📄</div>
        <div className="title-2">Belege hierher ziehen</div>
        <p className="muted small" style={{ margin: "6px 0 18px" }}>JPEG, PNG, HEIC oder PDF · Fotos werden nicht gespeichert</p>
        <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); camRef.current?.click(); }}>📸 Foto aufnehmen</button>
          <button type="button" className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>Dateien wählen</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />
      </div>

      {uploads.length > 0 && (
        <div className="list">
          {uploads.map((u) => (
            <div key={u.key} className="list-item">
              <div className="doc-thumb">{u.preview ? <img src={u.preview} alt="" /> : "📄"}</div>
              <div className="grow">
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                <div className={`small ${u.status === "error" ? "" : "muted"}`} style={u.status === "error" ? { color: "var(--red)" } : undefined}>
                  {u.status === "uploading" ? "KI analysiert den Beleg …" : u.error}
                </div>
              </div>
              {u.status === "uploading" ? <span className="spinner" style={{ color: "var(--accent)" }} /> : (
                <button className="btn btn-ghost btn-sm" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      <BankImport onDone={(m) => toast.show(m)} />

      <section className="stack">
        <div className="row-between">
          <h2 className="title-2">Deine Belege</h2>
          {pendingCount > 0 && <span className="badge badge-orange">{pendingCount} zu prüfen</span>}
        </div>
        {docs === null && <div className="shimmer" style={{ height: 80, borderRadius: 18 }} />}
        {docs?.length === 0 && <p className="muted">Noch keine Belege. Starte mit deinem Lohnzettel – du findest ihn in FinanzOnline unter „Abfragen“.</p>}
        {docs?.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            preview={previews[d.id]}
            open={open === d.id}
            onToggle={() => setOpen(open === d.id ? null : d.id)}
            onSave={(body) => patch(d, body)}
            onDelete={() => remove(d)}
          />
        ))}
      </section>
      {toast.node}
    </div>
  );
}

function DocumentCard({
  doc, preview, open, onToggle, onSave, onDelete,
}: {
  doc: StoredDocument; preview?: string; open: boolean; onToggle: () => void;
  onSave: (b: Partial<Pick<StoredDocument, "extraction" | "applied">>) => Promise<void>;
  onDelete: () => void;
}) {
  const [ex, setEx] = useState<Extraction>(doc.extraction);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setEx(doc.extraction);
  }, [doc.extraction]);

  const t = DOCUMENT_TYPES[ex.documentType];
  const mainAmount = ex.documentType === "lohnzettel" ? ex.lohnzettel?.kz210 : ex.beleg ? belegAmount(ex) : null;
  const ro = doc.applied;
  const readOnly = (v: number) => <div className="input num" style={{ textAlign: "right", background: "var(--surface-2)" }}>{eur(v)}</div>;

  const setType = (type: DocumentType) =>
    setEx((e) => ({
      ...e,
      documentType: type,
      lohnzettel: type === "lohnzettel" ? (e.lohnzettel ?? emptyLz()) : e.lohnzettel,
      beleg: type !== "lohnzettel" ? (e.beleg ?? { betrag: null, datum: null, beschreibung: "", empfaenger: null, wkKategorie: type === "werbungskosten" ? "sonstige" : null, beruflicherAnteil: null }) : e.beleg,
    }));
  const setBeleg = (patch: Partial<NonNullable<Extraction["beleg"]>>) => setEx((x) => ({ ...x, beleg: { ...x.beleg!, ...patch } }));

  async function save(applied: boolean) {
    setBusy(true);
    await onSave({ extraction: ex, applied });
    setBusy(false);
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button className="list-item" style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }} onClick={onToggle} aria-expanded={open}>
        <div className="doc-thumb">{preview ? <img src={preview} alt="" /> : t.icon}</div>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{t.label}</div>
          <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.summary || doc.fileName}</div>
        </div>
        {typeof mainAmount === "number" && <span className="num" style={{ fontWeight: 600 }}>{eur(mainAmount)}</span>}
        {doc.applied ? <span className="badge badge-green">✓ Übernommen</span> : <span className="badge badge-orange">Prüfen</span>}
      </button>

      {open && (
        <div className="stack" style={{ padding: "4px 24px 24px", "--gap": "18px" } as React.CSSProperties}>
          <hr className="sep" />
          <div className="row wrap" style={{ gap: 8 }}>
            <span className={`badge ${ex.confidence === "hoch" ? "badge-green" : ex.confidence === "mittel" ? "badge-orange" : "badge-red"}`}>Erkennung: {ex.confidence}</span>
            {doc.demo && <span className="badge">Demo</span>}
            {ex.taxYear && <span className="badge">Jahr {ex.taxYear}</span>}
            <span className="badge">{doc.fileName}</span>
          </div>
          {ex.warnings.length > 0 && (
            <div className="notice notice-orange small">
              <span>⚠️</span>
              <ul style={{ margin: 0, paddingLeft: 16 }}>{ex.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}

          <div className="grid grid-2" style={{ gap: 14 }}>
            <div className="field">
              <label>Belegart</label>
              <select className="select" value={ex.documentType} onChange={(e) => setType(e.target.value as DocumentType)} disabled={ro}>
                {Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {ex.documentType === "werbungskosten" && ex.beleg && (
              <div className="field">
                <label>Kategorie (Kennzahl L1)</label>
                <select className="select" value={ex.beleg.wkKategorie ?? "sonstige"} disabled={ro} onChange={(e) => setBeleg({ wkKategorie: e.target.value as WkKategorie })}>
                  {Object.entries(WK_KATEGORIEN).map(([k, v]) => <option key={k} value={k}>{v.label} · KZ {v.kz}</option>)}
                </select>
              </div>
            )}
          </div>

          {ex.documentType === "lohnzettel" && ex.lohnzettel && (
            <div className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Arbeitgeber</label>
                  <input className="input" value={ex.lohnzettel.arbeitgeber ?? ""} disabled={ro} onChange={(e) => setEx((x) => ({ ...x, lohnzettel: { ...x.lohnzettel!, arbeitgeber: e.target.value } }))} />
                </div>
                <label className="row small" style={{ gridColumn: "1 / -1", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!ex.lohnzettel.istPension} disabled={ro} style={{ width: 18, height: 18 }}
                    onChange={(e) => setEx((x) => ({ ...x, lohnzettel: { ...x.lohnzettel!, istPension: e.target.checked } }))} />
                  <span>Das ist ein Lohnzettel über meine <strong>Pension</strong></span>
                </label>
                <div className="field">
                  <label>Telearbeitstage</label>
                  {ro ? <div className="input num" style={{ textAlign: "right", background: "var(--surface-2)" }}>{ex.lohnzettel.telearbeitstage ?? 0}</div> : (
                    <NumberInput value={ex.lohnzettel.telearbeitstage ?? 0} onChange={(v) => setEx((x) => ({ ...x, lohnzettel: { ...x.lohnzettel!, telearbeitstage: v } }))} suffix="Tage" />
                  )}
                </div>
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                {LZ_FIELDS.map(([k, label, kz]) => (
                  <div className="field" key={k}>
                    <label>{label} {kz !== "–" && <span className="tiny" style={{ color: "var(--accent)" }}>KZ {kz}</span>}</label>
                    {ro ? readOnly(Number(ex.lohnzettel![k] ?? 0)) : (
                      <MoneyInput value={Number(ex.lohnzettel![k] ?? 0)} onChange={(v) => setEx((x) => ({ ...x, lohnzettel: { ...x.lohnzettel!, [k]: v } }))} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ex.documentType !== "lohnzettel" && ex.documentType !== "unbekannt" && ex.beleg && (
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Beschreibung</label>
                <input className="input" value={ex.beleg.beschreibung} disabled={ro} onChange={(e) => setBeleg({ beschreibung: e.target.value })} />
              </div>
              <div className="field">
                <label>Betrag</label>
                {ro ? readOnly(ex.beleg.betrag ?? 0) : <MoneyInput value={ex.beleg.betrag ?? 0} onChange={(v) => setBeleg({ betrag: v })} />}
              </div>
              {ex.documentType === "werbungskosten" && (
                <div className="field">
                  <label>Beruflicher Anteil</label>
                  {ro ? <div className="input num" style={{ textAlign: "right", background: "var(--surface-2)" }}>{Math.round((ex.beleg.beruflicherAnteil ?? 1) * 100)} %</div> : (
                    <NumberInput value={Math.round((ex.beleg.beruflicherAnteil ?? 1) * 100)} max={100} suffix="%" onChange={(v) => setBeleg({ beruflicherAnteil: v / 100 })} />
                  )}
                  <span className="help">Bei privater Mitnutzung (z. B. Laptop) nur den beruflichen Anteil ansetzen.</span>
                </div>
              )}
            </div>
          )}

          {ex.documentType === "unbekannt" && <div className="notice small">Bitte wähle oben die passende Belegart, damit der Beleg übernommen werden kann.</div>}

          <div className="row wrap" style={{ gap: 10 }}>
            {doc.applied ? (
              <button className="btn btn-secondary" disabled={busy} onClick={() => save(false)}>Übernahme zurücknehmen</button>
            ) : (
              <button className="btn" disabled={busy || ex.documentType === "unbekannt"} onClick={() => save(true)}>
                {busy ? <span className="spinner" /> : "✓ Werte geprüft – übernehmen"}
              </button>
            )}
            <div className="spacer" />
            <button className="btn btn-danger btn-sm" onClick={onDelete}>Löschen</button>
          </div>
        </div>
      )}
    </div>
  );
}
