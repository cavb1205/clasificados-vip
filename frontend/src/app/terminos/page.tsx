import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos del servicio de PortalVip Chile.",
  alternates: { canonical: "/terminos" },
};

const LAST_UPDATED = "2026-05-28";

export default function TermsPage() {
  return (
    <article className="prose prose-invert max-w-3xl space-y-4 text-neutral-300">
      <header>
        <h1 className="text-3xl font-bold text-neutral-100">Términos y condiciones</h1>
        <p className="text-sm text-neutral-500">Vigente desde {LAST_UPDATED}</p>
      </header>

      <h2 id="objeto" className="mt-8 text-xl font-semibold text-neutral-100">1. Objeto</h2>
      <p>
        PortalVip Chile (&quot;la Plataforma&quot;) es un directorio en línea de anuncios
        clasificados para adultos en Chile. La Plataforma actúa exclusivamente como
        intermediario tecnológico que aloja anuncios; <strong>NO interviene en las
        transacciones, encuentros, ni servicios</strong> que las anunciantes acuerden con
        sus clientes.
      </p>

      <h2 id="edad" className="mt-6 text-xl font-semibold text-neutral-100">2. Edad mínima</h2>
      <p>
        El acceso y el uso de la Plataforma están reservados a <strong>personas mayores
        de 18 años</strong>. Toda anunciante debe acreditar su mayoría de edad mediante
        el proceso de verificación de identidad (KYC) descrito en estos términos. El
        ingreso al sitio implica la declaración expresa de tener al menos 18 años
        cumplidos.
      </p>

      <h2 id="kyc" className="mt-6 text-xl font-semibold text-neutral-100">3. Verificación de identidad obligatoria</h2>
      <p>
        Para publicar anuncios, toda usuaria debe completar el proceso de verificación
        que incluye: (a) imagen de cédula de identidad chilena o pasaporte vigente,
        (b) selfie sosteniendo el documento al lado del rostro, y (c) video corto leyendo
        la frase de consentimiento que la Plataforma genera al momento de la verificación,
        que incluye un código aleatorio único de fecha y referencia a PortalVip Chile.
      </p>
      <p>
        La verificación tiene por objeto: (i) confirmar la mayoría de edad, (ii) prevenir
        suplantación de identidad y trata de personas, (iii) acreditar el consentimiento
        libre y voluntario de la anunciante.
      </p>

      <h2 id="prohibiciones" className="mt-6 text-xl font-semibold text-neutral-100">4. Prohibiciones</h2>
      <p>Queda terminantemente prohibido:</p>
      <ul className="ml-6 list-disc space-y-1">
        <li>Publicar perfiles de menores de 18 años (cualquier denuncia se reporta a Carabineros y la PDI).</li>
        <li>Suplantar identidad o usar fotografías de terceros sin consentimiento.</li>
        <li>Publicar contenido bajo coacción de un tercero (trata, proxenetismo).</li>
        <li>Realizar actividades ilícitas a través de la Plataforma.</li>
        <li>Vulnerar la seguridad técnica del sitio (scraping, DDoS, ingeniería inversa).</li>
        <li>Publicar contenido difamatorio o que vulnere derechos de terceros.</li>
      </ul>

      <h2 id="pagos" className="mt-6 text-xl font-semibold text-neutral-100">5. Tarifa de publicación</h2>
      <p>
        La Plataforma cobra una tarifa plana por publicación según los planes disponibles
        (diario, semanal, mensual, etc.). El pago se realiza por transferencia bancaria
        directa y se acredita mediante el envío del comprobante para revisión manual.
      </p>
      <p>
        <strong>La Plataforma no intermedia los pagos por servicios entre anunciantes y
        clientes</strong>. Cualquier transacción derivada de los anuncios es exclusiva
        responsabilidad de las partes.
      </p>

      <h2 id="responsabilidad" className="mt-6 text-xl font-semibold text-neutral-100">6. Limitación de responsabilidad</h2>
      <p>
        La Plataforma se ofrece &quot;tal cual&quot;. No garantizamos la veracidad,
        actualidad ni calidad de los servicios ofrecidos por las anunciantes. Las
        interacciones, encuentros y consecuencias derivadas son exclusiva responsabilidad
        de las partes involucradas.
      </p>
      <p>
        La Plataforma podrá suspender o eliminar anuncios y cuentas que vulneren estos
        términos, sin obligación de reembolso de tarifas pagadas si la suspensión obedece
        a una vulneración acreditada.
      </p>

      <h2 id="moderacion" className="mt-6 text-xl font-semibold text-neutral-100">7. Moderación y suspensión</h2>
      <p>
        La Plataforma se reserva el derecho de moderar contenidos, suspender o eliminar
        cuentas, y reportar a las autoridades cualquier indicio de delito (Ley 21.523 de
        trata de personas, Código Penal arts. 367 y siguientes, entre otras).
      </p>

      <h2 id="datos" className="mt-6 text-xl font-semibold text-neutral-100">8. Datos personales</h2>
      <p>
        El tratamiento de datos personales se rige por la{" "}
        <Link href="/privacidad" className="text-pink-400 hover:underline">
          Política de Privacidad
        </Link>
        , en cumplimiento de la Ley 19.628 sobre protección de la vida privada.
      </p>

      <h2 id="modificaciones" className="mt-6 text-xl font-semibold text-neutral-100">9. Modificaciones</h2>
      <p>
        La Plataforma podrá modificar estos términos. La fecha de última actualización
        figura al inicio de este documento. Los cambios sustantivos serán comunicados
        por correo electrónico y notificación in-dashboard.
      </p>

      <h2 id="jurisdiccion" className="mt-6 text-xl font-semibold text-neutral-100">10. Jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Chile. Cualquier
        controversia será sometida a los Tribunales Ordinarios de Justicia de Santiago.
      </p>

      <h2 id="contacto" className="mt-6 text-xl font-semibold text-neutral-100">11. Contacto</h2>
      <p>
        Para consultas sobre estos términos, escribir a{" "}
        <span className="text-pink-400">contacto@portalvip.cl</span>.
      </p>
    </article>
  );
}
