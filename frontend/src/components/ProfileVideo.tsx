"use client";

/**
 * Reproductor del video del muro con disuasivos de descarga:
 * - controlsList="nodownload" oculta el botón de descarga del navegador.
 * - disablePictureInPicture evita sacarlo a ventana flotante.
 * - clic derecho deshabilitado (no "Guardar video como…").
 * - sin `download` ni enlace directo visible.
 * NOTA: ningún video web es 100% indescargable (existe la grabación de pantalla
 * y la pestaña de red); esto frena la descarga casual.
 */
export function ProfileVideo({ src }: { src: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950"
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        src={src}
        controls
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        playsInline
        preload="metadata"
        className="mx-auto max-h-[70vh] w-full object-contain"
      />
    </div>
  );
}
