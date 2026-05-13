/**
 * Términos y Condiciones — AgroM · FitoLink.
 *
 * Página estática, accesible sin login, linkada desde:
 *   - Footer del LoginPage ("Al acceder, aceptas los términos...")
 *   - RegisterPage (checkbox de aceptación)
 *   - LandingPage footer
 *
 * Castellano, registro Tipo A friendly (sin jerga legal innecesaria).
 * Cubre los puntos obligatorios sin convertirse en muralla de texto. Si
 * el negocio escala y aparece un departamento legal, esto se sustituye
 * por la versión revisada por abogado.
 */
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-earth-50">
      <header className="border-b border-earth-300/40 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/brand/agrom-wordmark.svg" alt="AgroM" className="h-8 w-auto" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
          § AGROM · FITOLINK
        </p>
        <h1 className="font-display text-4xl text-brand-700 mt-3 leading-tight">
          Términos y Condiciones de Uso
        </h1>
        <p className="font-display italic text-gray-500 mt-2">
          Última actualización: 12 de mayo de 2026
        </p>
        <div className="w-12 h-[2px] bg-terra-500 mt-6 mb-10" />

        <section className="prose prose-agrom max-w-none text-brand-900 leading-relaxed">
          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 01 · Quiénes somos</h2>
          <p>
            AgroM · FitoLink (en adelante, &laquo;el Servicio&raquo;) es una plataforma
            de inteligencia agraria de precisión operada por SystemRapid SL. El
            Servicio se ofrece a través del dominio agrom.es y subdominios técnicos
            como fitolink.systemrapid.io.
          </p>
          <p>
            Para cualquier consulta sobre estos términos, escribe a{' '}
            <a href="mailto:juang@systemrapid.io" className="text-brand-700 underline">
              juang@systemrapid.io
            </a>.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 02 · Qué hace el Servicio</h2>
          <p>
            El Servicio procesa datos satelitales (Sentinel-2 de Copernicus, Landsat
            y otros) y meteorológicos sobre las parcelas que el usuario registra,
            calcula índices de vegetación (NDVI, NDRE, SAVI) y temperatura de
            superficie, y genera informes y alertas accionables.
          </p>
          <p>
            Adicionalmente, el Servicio puede coordinar la aplicación fitosanitaria
            con dron sobre las zonas identificadas, registrar las actuaciones con
            trazabilidad digital y emitir documentación para cumplimiento PAC.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 03 · Alta y uso de la cuenta</h2>
          <p>
            Para usar el Servicio es necesario crear una cuenta facilitando un email
            válido y un nombre. El usuario es responsable de la veracidad de los
            datos aportados y de mantener la confidencialidad de sus credenciales.
          </p>
          <p>
            Determinados roles (piloto de drones, aseguradora, cooperativa) requieren
            verificación adicional por parte de AgroM antes de poder operar
            comercialmente en la plataforma.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 04 · Uso aceptable</h2>
          <p>El usuario se compromete a no utilizar el Servicio para:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Registrar parcelas sobre las que no tiene derecho de uso o propiedad.</li>
            <li>Suplantar la identidad de terceros.</li>
            <li>Realizar ingeniería inversa, extraer datos masivamente o intentar comprometer la seguridad de la plataforma.</li>
            <li>Cualquier actividad ilícita o contraria a la normativa agraria, fitosanitaria o de protección de datos vigente.</li>
          </ul>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 05 · Naturaleza de los datos satelitales</h2>
          <p>
            El Servicio se apoya en proveedores externos de datos satelitales
            (Copernicus, Microsoft Planetary Computer) y meteorológicos
            (Open-Meteo). Los datos tienen una resolución espacial y temporal
            finita: típicamente 10 metros y revisita de 5 días. Los informes
            generados son una herramienta de apoyo a la decisión, no una garantía
            absoluta del estado del cultivo.
          </p>
          <p>
            La decisión final sobre cualquier intervención en el cultivo —
            tratamiento, riego, recolección — corresponde al usuario o a su
            técnico de confianza. AgroM no asume responsabilidad por daños
            derivados de decisiones tomadas exclusivamente en base a la
            información del Servicio.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 06 · Modelo económico</h2>
          <p>
            La monitorización satelital y los informes diarios se ofrecen de forma
            gratuita durante la fase de validación del Servicio. La aplicación
            fitosanitaria con dron y otros servicios profesionales se facturan
            por hectárea efectivamente tratada, con presupuesto previo aceptado
            por el usuario.
          </p>
          <p>
            AgroM se reserva el derecho de modificar el modelo económico con
            preaviso de 30 días, comunicado por email a la dirección registrada.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 07 · Baja</h2>
          <p>
            El usuario puede dar de baja su cuenta en cualquier momento escribiendo
            a{' '}
            <a href="mailto:juang@systemrapid.io" className="text-brand-700 underline">
              juang@systemrapid.io
            </a>{' '}
            o respondiendo &laquo;BAJA&raquo; al informe matutino diario.
          </p>
          <p>
            Los datos del usuario se conservan durante el periodo legalmente
            exigido tras la baja (típicamente 4 años para registros PAC y
            obligaciones fiscales) y se eliminan después salvo solicitud expresa
            anterior.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 08 · Propiedad intelectual</h2>
          <p>
            Los algoritmos, modelos de detección, interfaces y materiales gráficos
            del Servicio son propiedad de SystemRapid SL. Los datos brutos
            satelitales pertenecen a sus respectivos proveedores (programa
            Copernicus de la UE, NASA, etc.) y se utilizan bajo sus licencias
            abiertas.
          </p>
          <p>
            Los datos generados por el usuario — perímetros de parcelas, tipo de
            cultivo, registros de aplicaciones — son propiedad del usuario, que
            cede a AgroM una licencia no exclusiva para procesarlos en el marco
            del Servicio.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 09 · Limitación de responsabilidad</h2>
          <p>
            En la medida permitida por la ley, la responsabilidad de SystemRapid SL
            por daños derivados del uso del Servicio queda limitada al importe
            efectivamente abonado por el usuario en los doce meses anteriores al
            hecho que origine la reclamación. Esta limitación no se aplica a
            supuestos de dolo o negligencia grave.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 10 · Modificación de los términos</h2>
          <p>
            Estos términos pueden actualizarse para reflejar cambios en el
            Servicio o en la normativa. Las modificaciones sustanciales se
            comunicarán al usuario por email con al menos 30 días de antelación.
            El uso continuado del Servicio tras la entrada en vigor de los
            nuevos términos implica su aceptación.
          </p>

          <h2 className="font-display text-2xl text-brand-700 mt-10 mb-3">§ 11 · Ley aplicable</h2>
          <p>
            Estos términos se rigen por la legislación española. Para cualquier
            controversia, las partes se someten a los Juzgados y Tribunales de la
            ciudad donde radique el domicilio social de SystemRapid SL, con
            renuncia expresa a cualquier otro fuero que pudiera corresponderles.
          </p>
        </section>

        <div className="mt-16 border-t border-earth-300/40 pt-6 flex justify-between items-center text-sm">
          <Link to="/" className="text-brand-700 hover:underline">
            ← Volver al inicio
          </Link>
          <Link to="/privacy" className="text-brand-700 hover:underline">
            Política de privacidad →
          </Link>
        </div>
      </main>

      <footer className="border-t border-earth-300/40 bg-white mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
            AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN · 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
