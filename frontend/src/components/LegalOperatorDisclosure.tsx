import { legalProfile, operatorIdentityComplete } from "@/lib/legal-profile";

export function LegalOperatorDisclosure() {
  return (
    <section className="rounded-xl border border-neutral-700 bg-neutral-900/70 p-4 text-sm">
      <h2 className="font-semibold text-neutral-100">Identificación del operador</h2>
      <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[11rem_1fr]">
        <dt className="text-neutral-500">Tipo</dt>
        <dd>
          {legalProfile.operatorKind === "natural" ? "Persona natural" :
            legalProfile.operatorKind === "juridica" ? "Persona jurídica" : "Pendiente de definir"}
        </dd>
        <dt className="text-neutral-500">Nombre o razón social</dt>
        <dd>{legalProfile.operatorName ?? "Pendiente de informar"}</dd>
        <dt className="text-neutral-500">RUT</dt>
        <dd>{legalProfile.operatorRut ?? "Pendiente de informar"}</dd>
        <dt className="text-neutral-500">Domicilio</dt>
        <dd>{legalProfile.operatorAddress ?? "Pendiente de informar"}</dd>
        {legalProfile.operatorKind === "juridica" && (
          <>
            <dt className="text-neutral-500">Representante legal</dt>
            <dd>{legalProfile.representative ?? "Pendiente de informar"}</dd>
          </>
        )}
        <dt className="text-neutral-500">Contacto</dt>
        <dd>
          {legalProfile.contactEmail ? (
            <a className="break-all text-pink-300 underline" href={`mailto:${legalProfile.contactEmail}`}>
              {legalProfile.contactEmail}
            </a>
          ) : "Pendiente de habilitar"}
        </dd>
        <dt className="text-neutral-500">Privacidad</dt>
        <dd>
          {legalProfile.privacyEmail ? (
            <a className="break-all text-pink-300 underline" href={`mailto:${legalProfile.privacyEmail}`}>
              {legalProfile.privacyEmail}
            </a>
          ) : "Pendiente de habilitar"}
        </dd>
      </dl>
      {!operatorIdentityComplete && (
        <p className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-amber-100" role="status">
          La identidad legal del operador aún no está completa. Este documento es un borrador operativo y no debe tratarse como revisión legal final ni usarse para iniciar cobros.
        </p>
      )}
    </section>
  );
}
