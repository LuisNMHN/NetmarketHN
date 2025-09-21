import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de privacidad | NetMarketHN",
  description: "Cómo tratamos tus datos personales y cuáles son tus derechos.",
}

export default function PrivacidadPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <article className="prose prose-slate dark:prose-invert max-w-none bg-background border border-border rounded-lg p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">Última actualización: 21/09/2025</p>
        <h1 className="mb-6">Política de privacidad</h1>

        <h2 id="alcance">1. Alcance</h2>
        <p>
          <strong>Esta Política aplica al uso de NetMarketHN en Honduras.</strong> Si utilizas integraciones o
          proveedores externos de pago, sus políticas de privacidad también aplican.
        </p>

        <h2 id="datos">2. Datos que recopilamos</h2>
        <ul>
          <li>
            <strong>Identificación y contacto</strong> (nombre, correo, teléfono).
          </li>
          <li>
            <strong>Datos de cuenta y verificación (KYC)</strong>: documento, selfies, domicilio, actividad económica.
          </li>
          <li>
            <strong>Datos transaccionales</strong> (métodos de pago, montos, historial).
          </li>
          <li>Uso y dispositivo (IP, navegador, páginas visitadas, cookies/SDKs).</li>
        </ul>

        <h2 id="uso">3. Finalidades del tratamiento</h2>
        <ul>
          <li>
            <strong>Prestar los servicios</strong> (cuentas, enlaces de pago, subastas P2P).
          </li>
          <li>
            <strong>Prevención de fraude, cumplimiento legal</strong> y requerimientos de autoridad.
          </li>
          <li>Atención al cliente y mejoras del servicio.</li>
          <li>Comunicaciones transaccionales y, con tu permiso, comerciales.</li>
        </ul>

        <h2 id="base">4. Base legal</h2>
        <p>
          <strong>Ejecutar el contrato contigo</strong>; cumplir obligaciones legales y regulatorias;{" "}
          <strong>interés legítimo en seguridad y mejora del servicio</strong>; tu consentimiento cuando sea necesario.
        </p>

        <h2 id="terceros">5. Compartición con terceros</h2>
        <p>
          <strong>Proveedores de pago, verificación de identidad, análisis antifraude</strong>, hosting y soporte.
          Exigimos salvaguardas y solo compartimos lo necesario para cada finalidad.
        </p>

        <h2 id="retencion">6. Retención y seguridad</h2>
        <p>
          <strong>Conservamos datos por el tiempo necesario</strong> para las finalidades y conforme a plazos legales
          aplicables. Aplicamos
          <strong> medidas técnicas y organizativas razonables</strong> para proteger la información.
        </p>

        <h2 id="derechos">7. Tus derechos</h2>
        <ul>
          <li>
            <strong>Acceso, rectificación y actualización.</strong>
          </li>
          <li>
            <strong>Oposición y limitación</strong> en casos permitidos por ley.
          </li>
          <li>
            <strong>Portabilidad</strong> cuando aplique.
          </li>
          <li>
            <strong>Retiro del consentimiento</strong> sin efectos retroactivos.
          </li>
        </ul>

        <h2 id="cookies">8. Cookies y analítica</h2>
        <p>
          Usamos <strong>cookies/SDKs para funcionalidades esenciales y analítica.</strong> Puedes gestionar
          preferencias desde tu navegador o desde un banner de cookies si corresponde.
        </p>

        <h2 id="menores">9. Menores de edad</h2>
        <p>
          Si detectamos <strong>cuentas de menores sin autorización válida</strong>, podremos suspender o eliminar el
          acceso siguiendo el marco legal aplicable.
        </p>

        <h2 id="cambios">10. Cambios a esta política</h2>
        <p>
          <strong>Podremos actualizar esta Política.</strong> La fecha de "Última actualización" indica la vigencia.
          Cambios relevantes se comunicarán por medios razonables.
        </p>

        <h2 id="contacto">11. Contacto</h2>
        <p>
          Para consultas sobre privacidad y protección de datos, contáctanos en:{" "}
          <strong>
            <a className="text-primary underline" href="mailto:info@netmarkethn.com">
              info@netmarkethn.com
            </a>
          </strong>
        </p>
      </article>
    </div>
  )
}
