# Preparación legal y operativa — PortalVip Chile

Documento interno de trabajo; no es una opinión jurídica ni reemplaza la revisión de un abogado chileno o de un contador. La clasificación jurídica del directorio para adultos se deja expresamente para la última etapa, según lo acordado con el operador.

## Bloqueos conocidos antes de abrir cobros o hacer lanzamiento comercial

- **Operador sin definir.** No inventar nombre, RUT, domicilio ni representante. Completar las variables públicas de `frontend/.env.example` y verificar que coincidan con la entidad que inicia actividades, recibe transferencias, contrata proveedores y responde las solicitudes. Las páginas legales muestran los campos pendientes mientras no se configuren.
- **Dos líneas de negocio.** El producto ofrece directorio de anuncios para adultos y publicaciones de habitaciones. Revisar los términos aplicables a cada publicación, precio/plan, contacto, contratación posterior, disputas y límites de responsabilidad. No describir la plataforma como mero “avisador” sin dictamen sobre su operación real.
- **Proveedores y transferencias de datos.** Completar `NEXT_PUBLIC_PRIVACY_PROCESSORS` con cada proveedor que pueda recibir datos, función, categorías tratadas y país/región. Verificar contratos, acceso del proveedor, transferencias internacionales, subprocesadores y borrado. La lista debe corresponder a producción, no a una lista aspiracional.
- **Impuestos y documentos tributarios.** Antes de cobrar planes, obtener clasificación tributaria del SII/contador, confirmar inicio de actividades, IVA aplicable, emisión de DTE (boleta/factura según corresponda), conciliación y tratamiento de devoluciones. El repositorio implementa pagos por transferencia y revisión manual de comprobantes; no se encontró un flujo de emisión de DTE. Mantener comprobantes privados y pedir a quien paga que oculte información bancaria innecesaria.
- **Conservación y derechos.** Aprobar plazos por categoría (cuenta, perfil público, KYC, comprobante, reportes y logs), suprimir o anonimizar al vencerlos y probar el resultado también en backups y almacenamiento privado. No aplicar un plazo genérico de cinco años a toda la documentación. Las solicitudes recibidas en `/cuenta` se revisan manualmente desde Django Admin; al cerrarlas hay que registrar qué acción se ejecutó o por qué no proceden, visible para la persona en Mi cuenta. No marcarlas resueltas antes de ejecutar y documentar la acción. No solicitar copia de cédula por defecto.
- **Atención de reportes graves.** El producto tiene colas de reportes internas; no ejecuta denuncias externas. Para reportes de minoría de edad, coacción, trata, suplantación o material íntimo no consentido: restringir de inmediato la visibilidad, limitar el acceso interno, guardar solo evidencia mínima necesaria de forma privada, registrar decisiones y escalar según asesoría jurídica y obligaciones aplicables. No descargar, copiar ni redistribuir material sospechoso. Responder requerimientos oficiales por un canal autenticado y registrar qué se comunicó, a quién y bajo qué fundamento.
- **Consentimiento y versiones.** El backend registra versión, rol y fecha de aceptación de Términos, confirmación de lectura de Privacidad y una autorización KYC separada para nuevas verificaciones. Los expedientes KYC históricos no reciben consentimiento retroactivo; revisar su base, accesos y retención por separado. Al cambiar documentos, incrementar `LEGAL_TERMS_VERSION` y/o `LEGAL_PRIVACY_VERSION`; probar la nueva aceptación antes de desplegar. Las cuentas antiguas pueden revisar/aceptar la versión actual desde Mi cuenta. Mantener `LEGAL_ACCEPTANCE_ENFORCEMENT=False` durante el primer despliegue; activarlo solo después de probar la reaceptación en producción controlada y coordinarla con las cuentas existentes. Si se activa, las funciones protegidas quedan bloqueadas hasta reaceptar. La confirmación de lectura no sustituye una base jurídica válida ni el dictamen pendiente.
- **Edad y contenido.** El aviso 18+ es una autodeclaración almacenada en el navegador; no acredita la edad del visitante. KYC se aplica a quien publica en la línea para adultos. Revisar con abogado las medidas de edad y moderación apropiadas sin recoger datos de visitantes de más de lo necesario.

## Checklist de salida

- [ ] Entidad, RUT, domicilio, representante y contactos legales reales cargados y verificados.
- [ ] Lista de proveedores, ubicaciones y garantías aprobada y publicada.
- [ ] Términos y Política revisados por abogado y adaptados al contrato, a los planes y a ambas líneas.
- [ ] Procedimiento de conservación/borrado probado; canal de derechos atendido por personal designado.
- [ ] Protocolo de reportes graves, escalamiento y requerimientos oficiales probado con responsables y suplentes.
- [ ] Inicio de actividades, clasificación IVA y emisión de documentos tributarios confirmados con contador/SII.
- [ ] Personal autorizado capacitado; accesos de producción y comprobantes/KYC limitados y auditados.
- [ ] Dictamen escrito sobre la clasificación del modelo adulto y la operación concreta del sitio.

## Variables públicas del sitio

Completar en el proveedor del frontend (por ejemplo, variables de build/deploy) y en el `.env.local` de desarrollo:

- `NEXT_PUBLIC_LEGAL_OPERATOR_KIND`: `natural` o `juridica`.
- `NEXT_PUBLIC_LEGAL_OPERATOR_NAME`, `NEXT_PUBLIC_LEGAL_OPERATOR_RUT`, `NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS`.
- `NEXT_PUBLIC_LEGAL_REPRESENTATIVE` cuando el operador sea persona jurídica.
- `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` y `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` una vez que existan buzones atendidos.
- `NEXT_PUBLIC_PRIVACY_PROCESSORS`: proveedores reales, categorías de datos, funciones y ubicaciones.

Estas variables se incluyen en el JavaScript/HTML público: no introducir claves, tokens ni otros secretos.
