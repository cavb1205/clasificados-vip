import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Tratamiento de datos personales en PortalVip Chile.",
  alternates: { canonical: "/privacidad" },
};

const LAST_UPDATED = "2026-05-28";

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-3xl space-y-4 text-neutral-300">
      <header>
        <h1 className="text-3xl font-bold text-neutral-100">Política de privacidad</h1>
        <p className="text-sm text-neutral-500">Vigente desde {LAST_UPDATED}</p>
      </header>

      <h2 id="responsable" className="mt-8 text-xl font-semibold text-neutral-100">1. Responsable del tratamiento</h2>
      <p>
        PortalVip Chile (en adelante &quot;la Plataforma&quot;) es responsable del
        tratamiento de los datos personales descritos en esta Política, conforme a la
        Ley 19.628 sobre protección de la vida privada.
      </p>

      <h2 id="datos-recolectados" className="mt-6 text-xl font-semibold text-neutral-100">2. Datos que recolectamos</h2>
      <p>De los <strong>usuarios anunciantes (modelos)</strong>:</p>
      <ul className="ml-6 list-disc space-y-1">
        <li>Email y nombre de usuario (registro).</li>
        <li>Contraseña (almacenada con hash; nunca se guarda en texto plano).</li>
        <li>Nombre artístico, edad, descripción, ciudad, tarifa base (perfil público).</li>
        <li>Servicios y características declarados (etiquetas).</li>
        <li>Fotos y video del perfil (público, una vez verificado y publicado).</li>
        <li>WhatsApp y/o Telegram para contacto (visible bajo botón &quot;Contactar&quot;).</li>
        <li>
          <strong>Documentos de verificación (KYC)</strong>: cédula de identidad o
          pasaporte, selfie con documento y video de consentimiento. Se almacenan{" "}
          <strong>cifrados con Fernet</strong> en almacenamiento privado y solo son
          accesibles por personal autorizado para revisión, dejando registro auditado de
          cada acceso.
        </li>
      </ul>
      <p>De los <strong>visitantes y clientes</strong>:</p>
      <ul className="ml-6 list-disc space-y-1">
        <li>
          Eventos anónimos de visita y click en &quot;Contactar&quot; (sin IP ni
          identificadores persistentes; solo timestamp + tipo de evento, para que la
          anunciante vea estadísticas agregadas).
        </li>
        <li>Cookies técnicas necesarias para autenticación (no de tracking).</li>
      </ul>

      <h2 id="finalidades" className="mt-6 text-xl font-semibold text-neutral-100">3. Finalidades</h2>
      <ul className="ml-6 list-disc space-y-1">
        <li>Operar el servicio: alojar y mostrar anuncios verificados.</li>
        <li>Verificar identidad y mayoría de edad de las anunciantes.</li>
        <li>Prevenir suplantación, trata y publicación de menores.</li>
        <li>Notificar a las anunciantes sobre el estado de su KYC, pagos y reseñas.</li>
        <li>Generar estadísticas agregadas de visitas y contactos.</li>
        <li>Cumplir obligaciones legales y responder a requerimientos judiciales.</li>
      </ul>

      <h2 id="base-legal" className="mt-6 text-xl font-semibold text-neutral-100">4. Base legal</h2>
      <p>
        El tratamiento se basa en (a) el <strong>consentimiento expreso</strong> de la
        usuaria al registrarse y completar el proceso de KYC (video de consentimiento
        documentado), y (b) la ejecución del contrato de servicio que se materializa al
        usar la Plataforma.
      </p>

      <h2 id="cifrado" className="mt-6 text-xl font-semibold text-neutral-100">5. Seguridad</h2>
      <ul className="ml-6 list-disc space-y-1">
        <li>Toda comunicación con la Plataforma se realiza sobre <strong>HTTPS</strong> (TLS).</li>
        <li>
          Los documentos de KYC (cédula, selfie, video) se almacenan{" "}
          <strong>cifrados simétricamente</strong> (Fernet) y se descifran en memoria
          únicamente al ser revisados por personal autorizado.
        </li>
        <li>Contraseñas con hash criptográfico (no recuperables en texto plano).</li>
        <li>Cookies de sesión <strong>HttpOnly + Secure</strong>.</li>
        <li>Auditoría: cada acceso a documentos KYC queda registrado.</li>
        <li>Acceso restringido a personal autorizado.</li>
      </ul>

      <h2 id="comparticion" className="mt-6 text-xl font-semibold text-neutral-100">6. Con quién compartimos</h2>
      <p>
        La Plataforma <strong>no comparte ni vende datos personales a terceros</strong>{" "}
        con fines comerciales. Solo se entregan datos a las autoridades cuando exista una
        orden judicial debidamente notificada, en cumplimiento del Código Procesal Penal
        y la Ley 19.628.
      </p>

      <h2 id="retencion" className="mt-6 text-xl font-semibold text-neutral-100">7. Retención</h2>
      <ul className="ml-6 list-disc space-y-1">
        <li>
          Datos de cuenta y perfil: mientras la cuenta esté activa o exista una obligación
          legal de conservarlos.
        </li>
        <li>
          Documentos de KYC: se conservan{" "}
          <strong>encriptados durante toda la vida de la cuenta</strong>, como prueba del
          consentimiento informado y la mayoría de edad. Al cierre de la cuenta, se
          conservan por <strong>5 años adicionales</strong> para fines de defensa legal,
          y luego se destruyen criptográficamente.
        </li>
        <li>
          Eventos de visita/contacto agregados: 24 meses para análisis histórico, luego
          se anonimizan totalmente.
        </li>
      </ul>

      <h2 id="derechos" className="mt-6 text-xl font-semibold text-neutral-100">8. Tus derechos</h2>
      <p>Conforme a la Ley 19.628, toda usuaria tiene derecho a:</p>
      <ul className="ml-6 list-disc space-y-1">
        <li><strong>Acceso</strong>: solicitar copia de los datos que tenemos sobre ti.</li>
        <li><strong>Rectificación</strong>: corregir datos inexactos.</li>
        <li>
          <strong>Cancelación</strong>: solicitar la eliminación de tu cuenta y datos,
          salvo aquellos que debamos conservar por obligación legal.
        </li>
        <li><strong>Oposición</strong>: oponerte a tratamientos no esenciales.</li>
      </ul>
      <p>
        Para ejercer estos derechos, escribir a{" "}
        <span className="text-pink-400">privacidad@portalvip.cl</span> con copia de
        tu cédula para acreditar tu identidad.
      </p>

      <h2 id="cookies" className="mt-6 text-xl font-semibold text-neutral-100">9. Cookies y analítica</h2>
      <p>
        Usamos cookies <strong>técnicas estrictamente necesarias</strong> para la
        autenticación y la seguridad (token JWT HttpOnly, token CSRF). Para medir el
        tráfico del sitio de forma <strong>agregada y anónima</strong> usamos Vercel Web
        Analytics, que <strong>no usa cookies</strong> ni recolecta datos personales
        identificables. No usamos cookies de seguimiento publicitario ni elaboramos
        perfiles de usuarios.
      </p>

      <h2 id="menores" className="mt-6 text-xl font-semibold text-neutral-100">10. Menores de edad</h2>
      <p>
        La Plataforma no recolecta datos de menores de 18 años. Cualquier sospecha de
        perfil de menor será reportada inmediatamente a la Brigada de Cibercrimen de la
        PDI y Carabineros de Chile, y los datos asociados se entregarán bajo
        requerimiento judicial.
      </p>

      <h2 id="cambios" className="mt-6 text-xl font-semibold text-neutral-100">11. Modificaciones</h2>
      <p>
        Esta política puede modificarse. La fecha de última actualización figura al
        inicio. Los cambios sustantivos se comunicarán por correo y notificación
        in-dashboard.
      </p>

      <h2 id="contacto" className="mt-6 text-xl font-semibold text-neutral-100">12. Contacto</h2>
      <p>
        Encargado de privacidad:{" "}
        <span className="text-pink-400">privacidad@portalvip.cl</span>.
      </p>

      <p className="mt-8 text-sm text-neutral-500">
        Ver también:{" "}
        <Link href="/terminos" className="text-pink-400 hover:underline">
          Términos y condiciones
        </Link>
        .
      </p>
    </article>
  );
}
