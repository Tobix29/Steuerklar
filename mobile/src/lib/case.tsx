import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { getSecret, KEYS, setSecret } from "./secureStorage";
import { DEFAULT_YEAR, SUPPORTED_YEARS, type TaxCase, type TaxResult, type TaxYear } from "./types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface CaseCtx {
  year: TaxYear;
  setYear: (y: TaxYear) => void;
  data: TaxCase | null;
  result: TaxResult | null;
  documentCount: number;
  saveState: SaveState;
  error: string | null;
  loading: boolean;
  update: (fn: (draft: TaxCase) => void) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<CaseCtx | null>(null);

export function useCase() {
  const c = useContext(Ctx);
  if (!c) throw new Error("CaseProvider fehlt");
  return c;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [year, setYearState] = useState<TaxYear>(DEFAULT_YEAR);
  const [data, setData] = useState<TaxCase | null>(null);
  const [result, setResult] = useState<TaxResult | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<TaxCase | null>(null);

  useEffect(() => {
    getSecret(KEYS.year)
      .then((v) => {
        const y = Number(v);
        if ((SUPPORTED_YEARS as number[]).includes(y)) setYearState(y as TaxYear);
      })
      .catch(() => {});
  }, []);

  const reload = useCallback(async () => {
    try {
      const r = await api<{ case: TaxCase; result: TaxResult; documents: number }>(`/api/case?year=${year}`);
      setData(r.case);
      setResult(r.result);
      setDocumentCount(r.documents);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const flush = useCallback(async () => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaveState("saving");
    try {
      const r = await api<{ case: TaxCase; result: TaxResult }>("/api/case", { method: "PUT", json: next });
      setResult(r.result);
      setSaveState("saved");
      setError(null);
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }, []);

  const update = useCallback(
    (fn: (draft: TaxCase) => void) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = clone(prev);
        fn(next);
        pending.current = next;
        return next;
      });
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 600);
    },
    [flush],
  );

  // Ausstehende Änderungen nicht verlieren, wenn der Provider abgebaut wird
  useEffect(() => () => void flush(), [flush]);

  const setYear = (y: TaxYear) => {
    void flush();
    setYearState(y);
    void setSecret(KEYS.year, String(y)).catch(() => {});
  };

  return (
    <Ctx.Provider value={{ year, setYear, data, result, documentCount, saveState, error, loading, update, reload }}>
      {children}
    </Ctx.Provider>
  );
}
