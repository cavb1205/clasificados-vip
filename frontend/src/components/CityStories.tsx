"use client";

import { useState } from "react";
import Image from "next/image";
import { Viewer } from "./StoriesStrip";
import type { Story } from "@/lib/types";

export interface CityStoryModel {
  slug: string;
  stage_name: string;
  cover_photo: string | null;
  stories: Story[];
}

/**
 * Franja de historias de la página de ciudad: una burbuja por modelo con
 * historias activas. Al abrir, el viewer encadena de una modelo a la siguiente.
 */
export function CityStories({ models }: { models: CityStoryModel[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (models.length === 0) return null;

  function advance() {
    setActive((i) => {
      if (i === null) return null;
      return i + 1 < models.length ? i + 1 : null; // siguiente modelo o cerrar
    });
  }

  return (
    <section className="mb-6" aria-label="Historias en esta comuna">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {models.map((m, i) => (
          <button
            key={m.slug}
            type="button"
            onClick={() => setActive(i)}
            className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1"
            aria-label={`Ver historias de ${m.stage_name}`}
          >
            <span className="relative inline-block">
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ecccb9] via-[#c68b6a] to-[#9f6242]" />
              <span className="relative m-[3px] block h-16 w-16 overflow-hidden rounded-full border-2 border-neutral-950">
                {m.cover_photo && (
                  <Image
                    src={m.cover_photo}
                    alt=""
                    width={64}
                    height={64}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
            </span>
            <span className="w-full truncate text-center text-xs text-neutral-300">
              {m.stage_name}
            </span>
          </button>
        ))}
      </div>

      {active !== null && (
        <Viewer
          key={models[active].slug}
          stories={models[active].stories}
          startAt={0}
          stageName={models[active].stage_name}
          onClose={() => setActive(null)}
          onComplete={advance}
        />
      )}
    </section>
  );
}
