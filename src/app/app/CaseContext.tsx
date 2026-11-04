"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { DEFAULT_YEAR, SUPPORTED_YEARS, type TaxYear } from "@/lib/tax/constants";
import type { TaxCase, TaxResult } from "@/lib/tax/types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Ctx {
  year: TaxYear;
  setYear: (y: TaxYear) => void;
  data: TaxCase | null;
  result: TaxResult | null;
  documentCount: number;
  storagePersistent: boolean;
  saveState: SaveState;
  error: string | null;
  update: (fn: (draft: TaxCase) => void) => void;
  reload: () => Promise<void>;
}

const CaseCtx = createContext<Ctx | null>(null);

export function useCase() {
  const c = useContext(CaseCtx);
  if (!c) throw new Error("CaseProvider fehlt");
  return c;
}

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [year, setYearState] = useState<TaxYear>(DEFAULT_YEAR);
  const [data, setData] = useState<TaxCase | null>(null);
  const [result, setResult] = useState<TaxResult | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [storagePersistent, setStoragePersistent] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<TaxCase | null>(null);

  useEffect(() => {
    try {
      const y = Number(localStorage.getItem("sk_year"));
      if ((SUPPORTED_YEARS as number[]).includes(y)) setYearState(y as TaxYear);
    } catch {}
  }, []);

  const reload = useCallback(async () => {
    try {
      const r = await api<{ case: TaxCase; result: TaxResult; documents: number; storagePersistent: boolean }>(`/api/case?year=${year}`);
      setData(r.case);
      setResult(r.result);
      setDocumentCount(r.documents);
      setStoragePersistent(r.storagePersistent);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    }
  }, [year]);

  useEffect(() => {
    setData(null);
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
        const next = structuredClone(prev);
        fn(next);
        pending.current = next;
        return next;
      });
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 500);
    },
    [flush],
  );

  const setYear = (y: TaxYear) => {
    void flush();
    setYearState(y);
    try {
      localStorage.setItem("sk_year", String(y));
    } catch {}
  };

  return (
    <CaseCtx.Provider value={{ year, setYear, data, result, documentCount, storagePersistent, saveState, error, update, reload }}>{children}</CaseCtx.Provider>
  );
}
