"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { dashboard } from "@/lib/client-api";

export interface ReorderableMedia {
  id: number;
  file_url: string;
  order: number;
}

interface MediaReorderGridProps {
  photos: ReorderableMedia[];
  onChange: () => void | Promise<void>;
}

function sortedPhotos(photos: ReorderableMedia[]) {
  return [...photos].sort((a, b) => a.order - b.order);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar el orden.";
}

/** Grilla de fotos con drag-and-drop y controles accesibles para touch/teclado. */
export function MediaReorderGrid({ photos, onChange }: MediaReorderGridProps) {
  const [items, setItems] = useState(() => sortedPhotos(photos));
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setItems(sortedPhotos(photos));
  }, [photos]);

  function onDragStart(e: React.DragEvent<HTMLDivElement>, id: number) {
    if (busy) {
      e.preventDefault();
      return;
    }
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>, id: number) {
    if (busy) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  }

  async function reorder(fromIdx: number, toIdx: number) {
    if (busy || fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || toIdx >= items.length) return;

    const previous = items;
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withNewOrder = reordered.map((item, index) => ({ ...item, order: index * 10 }));
    const changed = withNewOrder.filter(
      (item) => item.order !== previous.find((oldItem) => oldItem.id === item.id)?.order,
    );

    setErr("");
    setItems(withNewOrder);
    setBusy(true);
    try {
      await Promise.all(changed.map((item) => dashboard.updateMediaOrder(item.id, item.order)));
      await onChange();
    } catch (error) {
      setItems(previous);
      setErr(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function onDrop(e: React.DragEvent<HTMLDivElement>, targetId: number) {
    e.preventDefault();
    const sourceId = draggingId;
    setDraggingId(null);
    setOverId(null);
    if (sourceId === null || sourceId === targetId) return;
    await reorder(
      items.findIndex((item) => item.id === sourceId),
      items.findIndex((item) => item.id === targetId),
    );
  }

  async function remove(id: number) {
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      await dashboard.deleteMedia(id);
      await onChange();
    } catch (error) {
      setErr(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div role="list" aria-label="Fotos del muro" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((item, index) => {
          const isDragging = draggingId === item.id;
          const isOver = overId === item.id && draggingId !== item.id;
          const isFirst = index === 0;
          const isLast = index === items.length - 1;

          return (
            <div
              key={item.id}
              role="listitem"
              draggable={!busy}
              onDragStart={(e) => onDragStart(e, item.id)}
              onDragOver={(e) => onDragOver(e, item.id)}
              onDrop={(e) => onDrop(e, item.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setOverId(null);
              }}
              aria-label={`Foto ${index + 1} de ${items.length}`}
              className={`group relative cursor-grab overflow-hidden rounded-lg border bg-neutral-900 transition active:cursor-grabbing ${
                isOver ? "border-pink-500 ring-2 ring-pink-500/40" : "border-neutral-800"
              } ${isDragging ? "opacity-50" : ""}`}
            >
              <Image
                src={item.file_url}
                alt={`Foto ${index + 1}`}
                width={200}
                height={200}
                unoptimized
                draggable={false}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button
                  type="button"
                  disabled={isFirst || busy}
                  onClick={() => reorder(index, index - 1)}
                  aria-label={`Mover foto ${index + 1} a la posición ${index}`}
                  className="rounded-full bg-black/70 px-2 py-1 text-xs leading-none text-neutral-200 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={isLast || busy}
                  onClick={() => reorder(index, index + 1)}
                  aria-label={`Mover foto ${index + 1} a la posición ${index + 2}`}
                  className="rounded-full bg-black/70 px-2 py-1 text-xs leading-none text-neutral-200 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={busy}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-red-300 disabled:opacity-40"
                title="Eliminar"
                aria-label={`Eliminar foto ${index + 1}`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-neutral-500" aria-live="polite">
        Usa ↑ ↓ o arrastra para reordenar{busy && " · guardando…"}
      </p>
      {err && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {err}
        </p>
      )}
    </div>
  );
}
