import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Términos y condiciones | NetMarketHN",
  description: "Condiciones de uso de la plataforma NetMarketHN para Honduras.",
}

export default function TerminosPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <article className="prose prose-slate dark:prose-invert max-w-none bg-background border border-border rounded-lg p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">Última actualización: 21/09/2025</p>
        <h1 className="mb-6">Términos y condiciones</h1>

        <h2 id="definiciones">1. Definiciones</h2>
        <p>
          <strong>"NetMarketHN"</strong> es una plataforma tecnológica que facilita enlaces de pago, subastas y
          operaciones P2P entre usuarios en Honduras.{" "}
          <strong>No es una entidad financiera ni presta servicios de custodia</strong>; opera como intermediario
          tecnológico con mecanismos de retención y liberación de fondos ("garantía") cuando aplique.
        </p>

        <h2 id="aceptacion">2. Aceptación y modificaciones</h2>
        <p>
          <strong>Al crear una cuenta o usar la plataforma, aceptas estos Términos.</strong> Podemos actualizarlos; los
          cambios entran en vigor al publicarse. Si no estás de acuerdo, debes dejar de usar los servicios.
        </p>

        <h2 id="registro">3. Registro y elegibilidad</h2>
        <ul>
          <li>
            <strong>Debes proporcionar información veraz</strong> y mantenerla actualizada.
          </li>
          <li>
            Podemos requerir <strong>verificación de identidad (KYC)</strong> y documentación adicional.
          </li>
          <li>Los menores de edad requieren representación o autorización conforme a la ley hondureña.</li>
        </ul>

        <h2 id="servicios">4. Servicios y limitaciones</h2>
        <p>
          Ofrecemos herramientas para cobrar, generar enlaces de pago y participar en subastas.{" "}
          <strong>La disponibilidad de métodos de pago depende de proveedores externos.</strong> Podemos limitar
          funcionalidades por riesgo, cumplimiento o capacidad operativa.
        </p>

        <h2 id="pago">5. Pagos, comisiones y liquidaciones</h2>
        <ul>
          <li>
            <strong>Las comisiones aplican según el método y el monto</strong>; se informan antes de confirmar.
          </li>
          <li>Las liquidaciones se realizan a las cuentas que configures, sujetas a verificaciones y contracargos.</li>
          <li>
            Los tiempos de liberación pueden variar por <strong>validaciones antifraude o disputas.</strong>
          </li>
        </ul>

        <h2 id="p2p">6. Operaciones P2P y garantía</h2>
        <p>
          En operaciones P2P con garantía,{" "}
          <strong>los fondos se retienen hasta el cumplimiento de condiciones de entrega.</strong>
          Incumplimientos, disputas y reembolsos se resuelven según la evidencia aportada y las políticas de resolución
          de conflictos.
        </p>

        <h2 id="prohibiciones">7. Usos prohibidos</h2>
        <ul>
          <li>
            <strong>Actividades ilícitas o restringidas por ley</strong> (narcóticos, armas, fraude, etc.).
          </li>
          <li>
            Suplantación de identidad, <strong>lavado de activos</strong> o elusión de sanciones.
          </li>
          <li>Abuso de la plataforma, spam o vulneración de propiedad intelectual.</li>
        </ul>

        <h2 id="responsabilidad">8. Responsabilidad y exenciones</h2>
        <p>
          Los servicios se brindan <strong>"tal cual"</strong>. No garantizamos disponibilidad ininterrumpida. En la
          medida permitida por ley, <strong>no somos responsables por pérdidas indirectas o lucro cesante.</strong>{" "}
          Proveedores de pago y terceros tienen términos propios.
        </p>

        <h2 id="propiedad">9. Propiedad intelectual</h2>
        <p>
          <strong>Marcas, logos, contenidos y software pertenecen a sus titulares.</strong> Te otorgamos una licencia
          limitada, no exclusiva y revocable para usar la plataforma conforme a estos Términos.
        </p>

        <h2 id="terminacion">10. Suspensión y terminación</h2>
        <p>
          <strong>Podemos suspender o cerrar cuentas por incumplimiento, riesgo, fraude o requerimiento legal.</strong>{" "}
          Tú puedes cerrar tu cuenta cuando quieras; algunas obligaciones pueden subsistir.
        </p>

        <h2 id="ley">11. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por <strong>las leyes de Honduras.</strong> Las controversias se someterán a los
          tribunales competentes de Tegucigalpa, salvo disposiciones imperativas distintas.
        </p>

        <h2 id="contacto">12. Contacto</h2>
        <p>
          Para dudas o solicitudes relacionadas con estos términos, contáctanos en:{" "}
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
