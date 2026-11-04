"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MoneyInput, Segmented, useToast } from "@/components/ui";
import { api, eur } from "@/lib/client/api";
import { DOCUMENT_TYPES, type DocumentType, type Extraction, type LohnsteuerFields } from "@/lib/ai/schema";
import type { StoredDocument } from "@/lib/server/repo";
import { useCase } from "../CaseContext";

const LST_FIELDS: [keyof LohnsteuerFields, string, string][] = [
  ["bruttoarbeitslohn", "Bruttoarbeitslohn", "3"],
  ["lohnsteuer", "Lohnsteuer", "4"],
  ["soli", "Solidaritätszuschlag", "5"],
  ["kirchensteuer", "Kirchensteuer", "6"],
  ["kirchensteuerEhegatte", "Kirchensteuer Ehegatte", "7"],
  ["lohnersatzleistungen", "Kurzarbeitergeld u. a.", "15"],
  ["steuerfreieFahrtkosten", "Steuerfreie Fahrtkosten", "17/18"],
  ["rvArbeitgeber", "Rentenversicherung AG", "22a"],
  ["rvArbeitnehmer", "Rentenversicherung AN", "23a"],
  ["zuschuesseKvPv", "Zuschüsse KV/PV", "24"],
  ["kvArbeitnehmer", "Krankenversicherung AN", "25"],
  ["pvArbeitnehmer", "Pflegeversicherung AN", "26"],
  ["alvArbeitnehmer", "Arbeitslosenversicherung AN", "27"],
  ["pkvBasis", "Private KV/PV (Basis)", "28"],
];

const emptyLst = (): LohnsteuerFields => ({
  arbeitgeber: null, bruttoarbeitslohn: null, lohnsteuer: null, soli: null, kirchensteuer: null, kirchensteuerEhegatte: null,
  lohnersatzleistungen: null, steuerfreieFahrtkosten: null, rvArbeitgeber: null, rvArbeitnehmer: null, zuschuesseKvPv: null,
  kvArbeitnehmer: null, pvArbeitnehmer: null, alvArbeitnehmer: null, pkvBasis: null, steuerId: null,
});

interface Upload { key: string; name: string; preview: string | null; status: "uploading" | "error"; error?: string }

export default function Belege() {
  const { year, data, reload } = useCase();
  const [docs, setDocs] = useState<StoredDocument[] | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [person, setPerson] = useState<0 | 1>(0);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const joint = data?.filing === "joint";

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
        fd.append("file", file);
        fd.append("year", String(year));
        fd.append("person", String(person));
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

  async function patch(doc: StoredDocument, body: Partial<Pick<StoredDocument, "extraction" | "personIndex" | "childId" | "applied">>) {
    try {
      const r = await api<{ document: StoredDocument }>(`/api/documents/${doc.id}`, { method: "PATCH", json: body });
      setDocs((d) => d?.map((x) => (x.id === doc.id ? r.document : x)) ?? null);
      await reload();
      if (body.applied === true) {
        toast.show("✓ In die Steuererklärung übernommen");
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
          <p className="muted" style={{ margin: "6px 0 0" }}>Fotografiere oder lade deine Belege hoch. Die KI erkennt alles, du bestätigst.</p>
        </div>
        {joint && (
          <Segmented label="Beleg gehört zu" value={person} onChange={setPerson} options={[{ value: 0, label: data?.persons[0]?.firstName || "Person 1" }, { value: 1, label: data?.persons[1]?.firstName || "Person 2" }]} />
        )}
      </header>

      {!aiEnabled && (
        <div className="notice notice-orange small">
          <span>🧪</span>
          <span><strong>Demo-Modus:</strong> Es ist kein KI-Schlüssel hinterlegt. Hochgeladene Belege liefern Beispielwerte einer Lohnsteuerbescheinigung.</span>
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
        <p className="muted small" style={{ margin: "6px 0 18px" }}>JPEG, PNG, HEIC oder PDF · max. 10 MB · Fotos werden nicht gespeichert</p>
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

      <section className="stack">
        <div className="row-between">
          <h2 className="title-2">Deine Belege</h2>
          {pendingCount > 0 && <span className="badge badge-orange">{pendingCount} zu prüfen</span>}
        </div>
        {docs === null && <div className="shimmer" style={{ height: 80, borderRadius: 18 }} />}
        {docs?.length === 0 && <p className="muted">Noch keine Belege. Starte mit deiner Lohnsteuerbescheinigung.</p>}
        {docs?.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            preview={previews[d.id]}
            open={open === d.id}
            onToggle={() => setOpen(open === d.id ? null : d.id)}
            joint={!!joint}
            persons={data?.persons.map((p, i) => p.firstName || `Person ${i + 1}`) ?? []}
            kids={data?.children.map((c) => ({ id: c.id, name: c.firstName || "Kind" })) ?? []}
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
  doc, preview, open, onToggle, joint, persons, kids, onSave, onDelete,
}: {
  doc: StoredDocument; preview?: string; open: boolean; onToggle: () => void; joint: boolean; persons: string[];
  kids: { id: string; name: string }[];
  onSave: (b: Partial<Pick<StoredDocument, "extraction" | "personIndex" | "childId" | "applied">>) => Promise<void>;
  onDelete: () => void;
}) {
  const [ex, setEx] = useState<Extraction>(doc.extraction);
  const [personIndex, setPersonIndex] = useState(doc.personIndex);
  const [childId, setChildId] = useState(doc.childId ?? kids[0]?.id);
  const [busy, setBusy] = useState(false);
  useEffect(() => setEx(doc.extraction), [doc.extraction]);

  const t = DOCUMENT_TYPES[ex.documentType];
  const mainAmount =
    ex.documentType === "lohnsteuerbescheinigung"
      ? ex.lohnsteuerbescheinigung?.bruttoarbeitslohn
      : ex.documentType === "handwerkerleistung" || ex.documentType === "haushaltsnahe_dienstleistung"
        ? ex.beleg?.arbeitskosten
        : ex.beleg?.betrag;
  const isLabor = ex.documentType === "handwerkerleistung" || ex.documentType === "haushaltsnahe_dienstleistung";

  const setType = (type: DocumentType) =>
    setEx((e) => ({
      ...e,
      documentType: type,
      lohnsteuerbescheinigung: type === "lohnsteuerbescheinigung" ? (e.lohnsteuerbescheinigung ?? emptyLst()) : e.lohnsteuerbescheinigung,
      beleg: type !== "lohnsteuerbescheinigung" ? (e.beleg ?? { betrag: null, arbeitskosten: null, datum: null, beschreibung: "", empfaenger: null, unbarGezahlt: null }) : e.beleg,
    }));

  async function save(applied: boolean) {
    setBusy(true);
    await onSave({ extraction: ex, personIndex, childId, applied });
    setBusy(false);
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button className="list-item" style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }} onClick={onToggle} aria-expanded={open}>
        <div className="doc-thumb">{preview ? <img src={preview} alt="" /> : t.icon}</div>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{t.label}</div>
          <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ex.summary || doc.fileName}
          </div>
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
              <select className="select" value={ex.documentType} onChange={(e) => setType(e.target.value as DocumentType)} disabled={doc.applied}>
                {Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {joint && (
              <div className="field">
                <label>Gehört zu</label>
                <select className="select" value={personIndex} onChange={(e) => setPersonIndex(Number(e.target.value))} disabled={doc.applied}>
                  {persons.map((p, i) => <option key={i} value={i}>{p}</option>)}
                </select>
              </div>
            )}
            {ex.documentType === "kinderbetreuung" && (
              <div className="field">
                <label>Kind</label>
                <select className="select" value={childId} onChange={(e) => setChildId(e.target.value)} disabled={doc.applied}>
                  {kids.length === 0 && <option>Bitte zuerst unter „Über dich“ ein Kind anlegen</option>}
                  {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {ex.documentType === "lohnsteuerbescheinigung" && ex.lohnsteuerbescheinigung && (
            <div className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
              <div className="field">
                <label>Arbeitgeber</label>
                <input className="input" value={ex.lohnsteuerbescheinigung.arbeitgeber ?? ""} disabled={doc.applied}
                  onChange={(e) => setEx((x) => ({ ...x, lohnsteuerbescheinigung: { ...x.lohnsteuerbescheinigung!, arbeitgeber: e.target.value } }))} />
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                {LST_FIELDS.map(([k, label, zeile]) => (
                  <div className="field" key={k}>
                    <label>{label} <span className="tiny" style={{ color: "var(--accent)" }}>Zeile {zeile}</span></label>
                    {doc.applied ? (
                      <div className="input num" style={{ textAlign: "right", background: "var(--surface-2)" }}>{eur(Number(ex.lohnsteuerbescheinigung![k] ?? 0))}</div>
                    ) : (
                      <MoneyInput value={Number(ex.lohnsteuerbescheinigung![k] ?? 0)}
                        onChange={(v) => setEx((x) => ({ ...x, lohnsteuerbescheinigung: { ...x.lohnsteuerbescheinigung!, [k]: v } }))} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ex.documentType !== "lohnsteuerbescheinigung" && ex.documentType !== "unbekannt" && ex.beleg && (
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Beschreibung</label>
                <input className="input" value={ex.beleg.beschreibung} disabled={doc.applied} onChange={(e) => setEx((x) => ({ ...x, beleg: { ...x.beleg!, beschreibung: e.target.value } }))} />
              </div>
              <div className="field">
                <label>Gesamtbetrag</label>
                {doc.applied ? <div className="input num" style={{ textAlign: "right", background: "var(--surface-2)" }}>{eur(ex.beleg.betrag ?? 0)}</div> : (
                  <MoneyInput value={ex.beleg.betrag ?? 0} onChange={(v) => setEx((x) => ({ ...x, beleg: { ...x.beleg!, betrag: v } }))} />
                )}
              </div>
              {isLabor && (
                <div className="field">
                  <label>Davon Arbeitskosten</label>
                  {doc.applied ? <div className="input num" style={{ textAlign: "right", background: "var(--surface-2)" }}>{eur(ex.beleg.arbeitskosten ?? 0)}</div> : (
                    <MoneyInput value={ex.beleg.arbeitskosten ?? 0} onChange={(v) => setEx((x) => ({ ...x, beleg: { ...x.beleg!, arbeitskosten: v } }))} />
                  )}
                  <span className="help">Nur Arbeit, Maschinen, Fahrt – ohne Material. Nur bei Überweisung begünstigt.</span>
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
