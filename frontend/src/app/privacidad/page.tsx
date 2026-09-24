import type { Metadata } from "next";
import Link from "next/link";
import { LegalOperatorDisclosure } from "@/components/LegalOperatorDisclosure";
import { legalProfile } from "@/lib/legal-profile";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Información sobre el tratamiento de datos en PortalVip Chile.",
  alternates: { canonical: "/privacidad" },
};

const LAST_UPDATED = "2026-09-24";

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-3xl space-y-4 text-neutral-300">
      <header>
        <h1 className="text-3xl font-bold text-neutral-100">Política de privacidad</h1>
        <p className="text-sm text-neutral-500">Borrador operativo · actualizado el {LAST_UPDATED}</p>
        <p>
          Este documento resume datos y usos observados en el producto. La identidad del responsable, la lista completa de proveedores y el calendario de conservación deben completarse antes de considerar esta política final.
        </p>
      </header>

      <LegalOperatorDisclosure />

      <h2 id="datos" className="mt-8 text-xl font-semibold text-neutral-100">1. Datos que puede tratar el servicio</h2>
      <ul className="ml-6 list-disc space-y-1">
        <li><strong>Cuenta:</strong> correo, nombre de usuario, credenciales protegidas, rol y preferencias necesarias para operar.</li>
        <li><strong>Perfiles para adultos:</strong> nombre artístico, edad declarada/verificada, descripción, ciudad, categorías de servicio, tarifas, fotos y videos públicos, y canales de contacto.</li>
        <li><strong>Habitaciones:</strong> datos del anfitrión y anuncios, comuna/sector, descripción, precio, fotos, teléfono y WhatsApp; el formulario indica que la dirección exacta no se publica.</li>
        <li><strong>Verificación de identidad:</strong> imagen de cédula o pasaporte, selfie y video de desafío/consentimiento. Se guardan en almacenamiento privado cifrado y el acceso administrativo queda auditado.</li>
        <li><strong>Pagos de publicación:</strong> plan contratado, estado, monto cuando se registra y comprobante de transferencia que la persona usuaria sube. Evita incluir datos bancarios de terceros que no sean necesarios.</li>
        <li><strong>Uso y seguridad:</strong> reportes, solicitudes de soporte, accesos a documentos KYC, acciones administrativas y eventos de visita/contacto vinculados al aviso para mostrar estadísticas. La infraestructura también puede procesar registros técnicos necesarios para seguridad y diagnóstico.</li>
      </ul>
      <p>
        Algunos datos del perfil, imágenes y categorías de servicio pueden revelar aspectos íntimos de una persona. No son datos de acceso público por el solo hecho de que el sitio los solicite: la publicación requiere una acción consciente de quien anuncia y se limita a los campos que muestra el perfil.
      </p>

      <h2 id="finalidades" className="mt-6 text-xl font-semibold text-neutral-100">2. Finalidades y autorizaciones</h2>
      <ul className="ml-6 list-disc space-y-1">
        <li>Crear y proteger cuentas, prestar los directorios de anuncios y gestionar planes y comprobantes.</li>
        <li>Verificar identidad y mayoría de edad de quienes publican en la sección para adultos y prevenir suplantaciones en el servicio.</li>
        <li>Mostrar al público los datos y contenidos que la persona eligió publicar, y revelar sus canales de contacto cuando se solicita esa función.</li>
        <li>Atender solicitudes, prevenir fraude, mantener seguridad, cumplir obligaciones legales y responder requerimientos válidos.</li>
        <li>Contabilizar visitas y acciones de contacto para las estadísticas del aviso y mejorar el servicio.</li>
      </ul>
      <p>
        El registro pide aceptar los Términos y confirmar por separado la lectura de esta Política. Esa confirmación no sustituye autorizaciones específicas: la subida de documentos KYC requiere una autorización adicional cuya versión y momento se registran. Si no se autorizan los datos indispensables para verificar una cuenta anunciante, no será posible completar esa verificación ni publicar en esa línea.
      </p>

      <h2 id="visibilidad" className="mt-6 text-xl font-semibold text-neutral-100">3. Qué se publica</h2>
      <p>
        Los datos marcados como públicos en el perfil o anuncio pueden ser vistos por cualquier visitante. Los documentos KYC, credenciales y comprobantes de pago no se muestran públicamente y su acceso está restringido al personal autorizado que los necesite. Los canales de contacto se muestran conforme a la acción indicada en la interfaz y a la configuración del aviso.
      </p>

      <h2 id="proveedores" className="mt-6 text-xl font-semibold text-neutral-100">4. Proveedores y comunicaciones</h2>
      <p>
        Para prestar el servicio se utilizan proveedores técnicos de alojamiento, infraestructura, almacenamiento, analítica y, cuando esté habilitado, correo. No se venden datos personales. Los proveedores pueden procesar datos bajo instrucciones del operador y con las salvaguardas contractuales que correspondan. Los datos podrán comunicarse a autoridades cuando exista una obligación o requerimiento válido, o cuando otra base legal permita actuar para proteger derechos o seguridad.
      </p>
      {legalProfile.processors ? (
        <p><strong>Proveedores, funciones y ubicaciones informadas por el operador:</strong> {legalProfile.processors}</p>
      ) : (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-amber-100" role="status">
          Pendiente antes del lanzamiento: identificar cada proveedor que pueda recibir datos, su finalidad, país/región de tratamiento y salvaguardas aplicables. La lista debe reflejar la configuración real de producción.
        </p>
      )}

      <h2 id="seguridad" className="mt-6 text-xl font-semibold text-neutral-100">5. Seguridad</h2>
      <p>
        El servicio usa conexiones HTTPS, credenciales almacenadas con hash, cookies de autenticación protegidas y almacenamiento privado cifrado para documentos KYC; el acceso a estos documentos deja un registro. Estas medidas reducen riesgos, pero ningún sistema conectado a Internet puede garantizar seguridad absoluta. Ante un incidente se aplicará el procedimiento interno y las notificaciones que exija la normativa.
      </p>

      <h2 id="retencion" className="mt-6 text-xl font-semibold text-neutral-100">6. Conservación y eliminación</h2>
      <p>
        Los datos deben conservarse solo durante el tiempo necesario para la finalidad informada o para cumplir una obligación legal. Los avisos y datos públicos deben dejar de mostrarse cuando termine su publicación o se tramite una solicitud válida de retiro. Los documentos KYC y comprobantes requieren plazos diferenciados, acceso restringido y eliminación segura al dejar de ser necesarios, salvo conservación legal o preservación documentada por un incidente o reclamo.
      </p>
      <p>
        El calendario exacto de conservación por categoría y su automatización siguen pendientes de aprobación del operador y revisión profesional. No se adopta aquí un plazo genérico de cinco años para todos los documentos.
      </p>

      <h2 id="derechos" className="mt-6 text-xl font-semibold text-neutral-100">7. Solicitudes y derechos</h2>
      <p>
        Desde <Link href="/cuenta" className="text-pink-400 hover:underline">Mi cuenta</Link> puedes pedir acceso o copia, rectificación, eliminación/cancelación, oposición o retiro de consentimiento. La solicitud queda registrada para que el equipo la revise; algunos datos pueden conservarse cuando exista una obligación legal o sea necesario resolver una controversia. No adjuntes una copia de tu cédula salvo que el responsable te explique por qué es necesaria y ofrezca un canal seguro. Las personas sin cuenta pueden usar el contacto de privacidad informado arriba.
      </p>

      <h2 id="cookies" className="mt-6 text-xl font-semibold text-neutral-100">8. Cookies y analítica</h2>
      <p>
        Se usan cookies técnicas necesarias para sesión y protección CSRF. El proyecto integra Vercel Web Analytics para visitas y métricas agregadas; según la documentación del proveedor, no utiliza cookies de seguimiento y calcula un hash de corta duración a partir de la solicitud para contar visitantes. No se configuran eventos analíticos personalizados en el código actual. La lista de proveedores y la región efectiva de tratamiento deben confirmarse para producción; esta Política debe actualizarse si se incorporan otras herramientas o tecnologías de medición.
      </p>

      <h2 id="menores" className="mt-6 text-xl font-semibold text-neutral-100">9. Menores y reportes urgentes</h2>
      <p>
        No se permite crear ni publicar anuncios de menores. Si detectas contenido que pueda involucrar a una persona menor de edad, explotación, coacción o imágenes íntimas no consentidas, usa la función de reportar y aporta solo la información necesaria. El equipo debe restringir el acceso al contenido y escalar el caso conforme al procedimiento interno y a las obligaciones legales; no envíes ni redistribuyas copias del contenido.
      </p>

      <h2 id="cambios" className="mt-6 text-xl font-semibold text-neutral-100">10. Cambios y contacto</h2>
      <p>
        La versión y fecha de esta Política se muestran al inicio. Cuando un cambio requiera nueva autorización, se solicitará de forma separada y quedará registrada. Para consultas o solicitudes, utiliza el contacto de privacidad que figure en la identificación del operador.
      </p>
      <p className="mt-8 text-sm text-neutral-500">
        Ver también: <Link href="/terminos" className="text-pink-400 hover:underline">Términos y condiciones</Link>.
      </p>
    </article>
  );
}
