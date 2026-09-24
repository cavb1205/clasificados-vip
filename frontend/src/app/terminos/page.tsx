import type { Metadata } from "next";
import Link from "next/link";
import { LegalOperatorDisclosure } from "@/components/LegalOperatorDisclosure";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso de los directorios de PortalVip Chile.",
  alternates: { canonical: "/terminos" },
};

const LAST_UPDATED = "2026-09-24";

export default function TermsPage() {
  return (
    <article className="prose prose-invert max-w-3xl space-y-4 text-neutral-300">
      <header>
        <h1 className="text-3xl font-bold text-neutral-100">Términos y condiciones</h1>
        <p className="text-sm text-neutral-500">Borrador operativo · actualizado el {LAST_UPDATED}</p>
        <p>
          Estos términos describen los servicios que ofrece actualmente el sitio. La identidad del operador y la revisión jurídica final siguen pendientes; consulta el aviso antes de crear una cuenta o pagar.
        </p>
      </header>

      <LegalOperatorDisclosure />

      <h2 id="servicios" className="mt-8 text-xl font-semibold text-neutral-100">1. Servicios y líneas del sitio</h2>
      <p>
        PortalVip Chile ofrece dos espacios de avisos: (a) un directorio de perfiles y anuncios para personas adultas y (b) un directorio de habitaciones ofrecidas por anfitriones. Quien publica debe elegir la categoría que corresponde y entregar información veraz. Los avisos, perfiles, precios y medios de contacto pertenecen a sus respectivos usuarios.
      </p>
      <p>
        En ambas líneas el sitio aloja, organiza y muestra avisos y puede cobrar a quien publica una tarifa por el plan seleccionado. El contacto posterior se realiza directamente entre las personas usuarias. Actualmente el sitio no cobra al público por encuentros ni recibe pagos de arriendo, reservas o servicios anunciados. Esta descripción informa las funciones disponibles, pero no determina por sí sola la calificación jurídica del servicio.
      </p>

      <h2 id="cuentas" className="mt-6 text-xl font-semibold text-neutral-100">2. Cuentas, edad e identidad</h2>
      <p>
        Para registrarse o visitar el sitio se debe tener al menos 18 años. El aviso de entrada solicita una declaración de mayoría de edad; no es una verificación de identidad de cada visitante. Las personas que publiquen perfiles para adultos deben completar la verificación de identidad indicada en el flujo de publicación. La verificación no garantiza por sí sola la veracidad de cada afirmación ni la ausencia de coacción.
      </p>
      <p>
        La cuenta de anfitrión permite administrar anuncios de habitaciones. El sitio no verifica la propiedad del inmueble, la disponibilidad, la autorización para subarrendar ni las condiciones particulares del arriendo; cada anfitrión debe contar con las facultades necesarias y publicar condiciones y precios exactos.
      </p>

      <h2 id="contenido" className="mt-6 text-xl font-semibold text-neutral-100">3. Contenido y conductas prohibidas</h2>
      <p>Está prohibido, entre otros:</p>
      <ul className="ml-6 list-disc space-y-1">
        <li>Publicar, solicitar o facilitar contenido o actividades que involucren a personas menores de 18 años.</li>
        <li>Publicar imágenes, videos, datos o anuncios de otra persona sin autorización suficiente, o contenido íntimo no consentido.</li>
        <li>Publicar contenido relacionado con coacción, explotación, trata de personas, suplantación o fraude.</li>
        <li>Entregar información engañosa sobre precio, disponibilidad, identidad, ubicación o condiciones de un aviso.</li>
        <li>Usar el sitio para vulnerar derechos de terceros, la ley o la seguridad del servicio.</li>
      </ul>
      <p>
        Quien sube contenido declara tener los derechos y autorizaciones necesarios. Concede al operador un permiso limitado, no exclusivo y revocable para alojarlo, adaptarlo técnicamente y mostrarlo dentro del servicio mientras el aviso esté activo. El uso promocional fuera del sitio requiere autorización separada.
      </p>

      <h2 id="planes" className="mt-6 text-xl font-semibold text-neutral-100">4. Planes, pagos y comprobantes</h2>
      <p>
        Antes de pagar, la pantalla de contratación debe informar el nombre del plan, precio total en pesos chilenos, duración, alcance, límites y beneficios aplicables. El pago de publicación se realiza mediante los medios que el sitio indique. Cuando se solicita un comprobante, el plan queda sujeto a revisión y no se considera aprobado por el solo hecho de subir una imagen.
      </p>
      <p>
        La tarifa cubre únicamente las prestaciones expresamente incluidas en el plan. No representa un pago por los servicios ofrecidos en el anuncio, un arriendo, una reserva ni una comisión sobre el contacto. Los derechos de retracto, término, devolución y demás derechos legales que correspondan se informarán y respetarán según la relación contractual concreta; una suspensión no elimina derechos irrenunciables que establezca la ley.
      </p>

      <h2 id="contacto-y-reportes" className="mt-6 text-xl font-semibold text-neutral-100">5. Contacto, reportes y moderación</h2>
      <p>
        Las personas usuarias pueden reportar avisos mediante las herramientas disponibles. El operador puede ocultar temporalmente contenido, solicitar antecedentes, limitar funciones o suspender cuentas cuando sea necesario para revisar un reporte, proteger a una persona o cumplir la ley. Se procurará comunicar el motivo y ofrecer un canal para aportar antecedentes cuando ello no interfiera con una investigación o medida de seguridad.
      </p>
      <p>
        Los reportes se revisan conforme al procedimiento interno de seguridad y a las obligaciones legales aplicables. La plataforma no promete que todo reporte implique automáticamente una denuncia ante una autoridad. Los requerimientos oficiales y las situaciones de riesgo se gestionan con acceso restringido y conforme a la normativa aplicable.
      </p>

      <h2 id="responsabilidad" className="mt-6 text-xl font-semibold text-neutral-100">6. Alcance del servicio</h2>
      <p>
        El sitio facilita la publicación y consulta de avisos; no garantiza disponibilidad, exactitud o resultado de las conversaciones o acuerdos entre usuarios. Cada parte debe verificar las condiciones antes de contratar o reunirse. Nada en estos términos excluye obligaciones o responsabilidades que la ley no permita excluir, ni limita los derechos de consumidores que resulten aplicables.
      </p>

      <h2 id="privacidad" className="mt-6 text-xl font-semibold text-neutral-100">7. Datos personales</h2>
      <p>
        El tratamiento de datos se explica en la <Link href="/privacidad" className="text-pink-400 hover:underline">Política de privacidad</Link>. Durante el registro, la aceptación de estos términos y la confirmación de lectura de la Política son acciones separadas. Las autorizaciones específicas, como la verificación KYC, se solicitan aparte.
      </p>

      <h2 id="cambios" className="mt-6 text-xl font-semibold text-neutral-100">8. Cambios</h2>
      <p>
        Los cambios se publicarán con su fecha y versión. Si un cambio requiere una nueva aceptación, se solicitará de forma explícita y quedará registrada antes de habilitar las funciones afectadas. Los cambios no alterarán retroactivamente prestaciones ya contratadas salvo que la ley lo permita.
      </p>

      <h2 id="ley" className="mt-6 text-xl font-semibold text-neutral-100">9. Ley aplicable y contacto</h2>
      <p>
        Se aplica la legislación de Chile y conocerán los tribunales competentes, sin restringir las reglas imperativas que protejan a consumidores o usuarios. Para consultas, usa el contacto que figura en la identificación del operador.
      </p>
    </article>
  );
}
