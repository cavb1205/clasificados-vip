"use client";

/** Paginador simple Anterior/Siguiente para las listas del panel admin. */
export function Pager({
  page,
  count,
  pageSize = 25,
  onPage,
}: {
  page: number;
  count: number;
  pageSize?: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-full border border-neutral-700 px-4 py-1.5 hover:border-pink-500 disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-neutral-400">
        Página {page} de {pages} · {count} total
      </span>
      <button
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="rounded-full border border-neutral-700 px-4 py-1.5 hover:border-pink-500 disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );
}
