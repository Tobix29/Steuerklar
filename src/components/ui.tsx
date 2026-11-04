"use client";
import { useEffect, useState } from "react";

export function MoneyInput({ value, onChange, id, ariaLabel, inline }: { value: number; onChange: (v: number) => void; id?: string; ariaLabel?: string; inline?: boolean }) {
  const fmt = (n: number) => (n ? n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  const [text, setText] = useState(fmt(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(fmt(value));
  }, [value, focus]);
  return (
    <div className="input-affix">
      <input
        id={id}
        aria-label={ariaLabel}
        className={`input${inline ? " input-inline" : ""}`}
        inputMode="decimal"
        value={text}
        placeholder="0,00"
        onFocus={() => setFocus(true)}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setText(t);
          const n = Number(t.replace(/\./g, "").replace(",", "."));
          if (Number.isFinite(n)) onChange(Math.min(Math.max(0, n), 10_000_000));
        }}
        onBlur={() => {
          setFocus(false);
          setText(fmt(value));
        }}
      />
      <span className="affix">€</span>
    </div>
  );
}

export function NumberInput({ value, onChange, id, max = 366, suffix, ariaLabel }: { value: number; onChange: (v: number) => void; id?: string; max?: number; suffix?: string; ariaLabel?: string }) {
  return (
    <div className="input-affix">
      <input
        id={id}
        aria-label={ariaLabel}
        className="input"
        inputMode="numeric"
        value={value || ""}
        placeholder="0"
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d]/g, ""));
          onChange(Math.min(max, Number.isFinite(n) ? n : 0));
        }}
        style={suffix ? { paddingRight: 52 } : undefined}
      />
      {suffix && <span className="affix">{suffix}</span>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={String(o.value)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return { show: setMsg, node };
}
