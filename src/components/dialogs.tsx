// Alert dialogs like AdwAlertDialog: heading, body, an optional text entry and response buttons.
// ask() resolves with the chosen response id (or the entry text for "ok" when there is an entry),
// null when closed with Escape or a click outside.
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { t } from "../i18n/i18n";

export interface Response {
  id: string;
  label: string;
  look?: "suggested" | "destructive";
}

interface Dialog {
  heading: string;
  body?: string;
  entry?: { placeholder?: string; value?: string; maxLength?: number };
  responses: Response[];
  /** response for Enter */
  default?: string;
  extra?: ReactNode;
  className?: string;
  resolve: (r: string | null) => void;
}

let current: Dialog | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function ask(d: Omit<Dialog, "resolve">): Promise<string | null> {
  current?.resolve(null);
  return new Promise((resolve) => {
    current = {
      ...d,
      resolve: (r) => {
        current = null;
        emit();
        resolve(r);
      },
    };
    emit();
  });
}

/** Closes the open dialog from outside (a key recorder that got its key), answering `r`. */
export function closeDialog(r: string | null = null) {
  current?.resolve(r);
}

/** Yes/no question; true when `ok` was chosen. */
export async function confirmDialog(heading: string, body: string, ok: string, look: Response["look"] = "suggested"): Promise<boolean> {
  return (await ask({ heading, body, responses: [{ id: "cancel", label: t("Cancel") }, { id: "ok", label: ok, look }], default: look === "destructive" ? "cancel" : "ok" })) === "ok";
}

/** Text entry; resolves with the trimmed text, or null when cancelled or empty. */
export async function entryDialog(heading: string, body: string, placeholder: string, ok: string): Promise<string | null> {
  const r = await ask({ heading, body, entry: { placeholder }, responses: [{ id: "cancel", label: t("Cancel") }, { id: "ok", label: ok, look: "suggested" }], default: "ok" });
  return r && r !== "cancel" ? r.trim() || null : null;
}

export function DialogHost() {
  const d = useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => current);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!d) return;
    (input.current ?? box.current?.querySelector<HTMLButtonElement>(`[data-id="${d.default ?? ""}"]`) ?? box.current?.querySelector("button"))?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") d.resolve(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [d]);
  if (!d) return null;
  const answer = (id: string) => d.resolve(id === "ok" && d.entry ? (input.current?.value ?? "") : id);
  return (
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && d.resolve(null)}>
      <div className={`dialog ${d.className ?? ""}`} role="alertdialog" aria-modal="true" aria-label={d.heading} ref={box}>
        <div className="body">
          {d.extra}
          <h2>{d.heading}</h2>
          {d.body && <p>{d.body}</p>}
          {d.entry && (
            <input ref={input} placeholder={d.entry.placeholder} defaultValue={d.entry.value} maxLength={d.entry.maxLength}
              onKeyDown={(e) => e.key === "Enter" && answer(d.default ?? "ok")} />
          )}
        </div>
        <div className="responses">
          {d.responses.map((r) => (
            <button key={r.id} data-id={r.id} className={r.look ? `${r.look}-text` : ""} onClick={() => answer(r.id)}>{r.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
