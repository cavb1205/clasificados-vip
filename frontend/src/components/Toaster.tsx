"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";
interface ToastItem { id: number; message: string; type: ToastType }

let items: ToastItem[] = [];
let listeners: ((items: ToastItem[]) => void)[] = [];

function emit() {
  for (const l of listeners) l(items);
}

/** Llamable desde cualquier componente cliente: toast("Guardado"). */
export function toast(message: string, type: ToastType = "success", ms = 3500) {
  const id = Date.now() + Math.random();
  items = [...items, { id, message, type }];
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    emit();
  }, ms);
}

const STYLE: Record<ToastType, string> = {
  success: "border-emerald-500/50 bg-emerald-950/80 text-emerald-100",
  error: "border-red-500/50 bg-red-950/80 text-red-100",
  info: "border-sky-500/50 bg-sky-950/80 text-sky-100",
};
const ICON: Record<ToastType, string> = { success: "✓", error: "⚠", info: "ℹ" };

/** Contenedor flotante; se monta una vez en el layout. */
export function Toaster() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-full border px-4 py-2.5 text-sm shadow-lg backdrop-blur ${STYLE[t.type]}`}
        >
          <span aria-hidden>{ICON[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
