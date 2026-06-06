"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox } from "@/components/PhotoGallery";

/** Avatar circular del perfil; al tocarlo se ve a tamaño completo (lightbox). */
export function AvatarView({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ver la foto de perfil de ${alt} en tamaño completo`}
        className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500"
      >
        <Image
          src={src}
          alt={alt}
          width={88}
          height={88}
          unoptimized
          className="h-20 w-20 cursor-zoom-in rounded-full object-cover ring-2 ring-pink-600/40"
        />
      </button>
      {open && (
        <Lightbox
          items={[{ type: "photo", url: src }]}
          alt={alt}
          index={0}
          onIndex={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
