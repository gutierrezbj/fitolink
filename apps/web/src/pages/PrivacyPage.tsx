/**
 * Política de Privacidad — AgroM · FitoLink.
 *
 * Cubre los puntos obligatorios bajo RGPD/LOPDGDD:
 *   - Identidad del responsable
 *   - Datos recogidos y por qué
 *   - Base legal del tratamiento
 *   - Cesiones a terceros (procesadores)
 *   - Plazos de conservación
 *   - Derechos del usuario y cómo ejercerlos
 *   - Cookies (mínimas, técnicas)
 *
 * Si el negocio escala a múltiples mercados, esto se sustituye por la
 * versión revisada por DPO/abogado. Para fase de validación es suficiente
 * y honesto.
 */
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-agrom-paper">
      <header className="border-b border-agrom-rule/40 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/brand/agrom-wordmark.svg" alt="AgroM" className="h-8 w-auto" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agrom-muted">
          § AGROM · FITOLINK
        </p>
        <h1 className="font-display text-4xl text-agrom-deep mt-3 leading-tight">
          Política de Privacidad
        </h1>
        <p className="font-display italic text-agrom-muted mt-2">
          Última actualización: 12 de mayo de 2026
        </p>
        <div className="w-12 h-[2px] bg-agrom-terra mt-6 mb-10" />

        <section className="text-agrom-ink leading-relaxed">
          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 01 · Responsable del tratamiento</h2>
          <p>
            SystemRapid SL (en adelante, &laquo;AgroM&raquo;) es la entidad
            responsable del tratamiento de los datos personales recogidos a
            través del Servicio FitoLink.
          </p>
          <p className="mt-3">
            Contacto para consultas sobre privacidad y ejercicio de derechos:{' '}
            <a href="mailto:juang@systemrapid.io" className="text-agrom-deep underline">
              juang@systemrapid.io
            </a>
          </p>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 02 · Qué datos tratamos</h2>
          <p>Los datos que recogemos directamente del usuario:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><b>Datos identificativos</b>: nombre, email, teléfono (opcional), avatar de Google (opcional).</li>
            <li><b>Datos profesionales</b>: rol seleccionado (agricultor, cooperativa, piloto, aseguradora), empresa (cuando aplica).</li>
            <li><b>Datos de las parcelas</b>: perímetro geográfico (polígono GeoJSON), tipo de cultivo, provincia, hectáreas.</li>
            <li><b>Datos de operaciones</b>: registros de aplicaciones drone, inspecciones, alertas atendidas.</li>
          </ul>
          <p className="mt-3">Datos generados automáticamente:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><b>Datos satelitales asociados</b>: NDVI, NDRE, SAVI, LST y otros índices calculados sobre los polígonos del usuario.</li>
            <li><b>Datos técnicos mínimos</b>: dirección IP en logs del servidor, fecha y hora de acceso. Sin tracking ni huella digital del navegador.</li>
          </ul>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 03 · Para qué los usamos</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li><b>Prestar el Servicio</b>: procesar imágenes satelitales sobre las parcelas, generar alertas, enviar el informe matutino diario.</li>
            <li><b>Comunicación operativa</b>: avisos críticos de salud del cultivo, confirmación de aplicaciones drone, baja del Servicio.</li>
            <li><b>Cumplimiento legal</b>: emisión de documentación PAC y conservación de registros fitosanitarios según normativa española.</li>
          </ul>
          <p className="mt-3">
            <b>No usamos los datos del usuario para publicidad, perfilado
            comercial ni los vendemos a terceros.</b>
          </p>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 04 · Base legal</h2>
          <p>El tratamiento se ampara en:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><b>Ejecución del contrato</b>: para todo lo necesario para prestar el Servicio que el usuario ha contratado al darse de alta.</li>
            <li><b>Consentimiento explícito</b>: al aceptar estos términos y la política de privacidad durante el alta.</li>
            <li><b>Obligación legal</b>: para la conservación de registros exigidos por la normativa PAC y fitosanitaria.</li>
            <li><b>Interés legítimo</b>: para la seguridad de la plataforma (logs técnicos, prevención de abuso).</li>
          </ul>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 05 · Con quién compartimos los datos</h2>
          <p>
            AgroM no comparte los datos del usuario con terceros para fines
            comerciales. Los proveedores tecnológicos que procesan datos en
            nuestro nombre son:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><b>Microsoft (Planetary Computer)</b>: acceso a datos satelitales históricos. Se les envían las coordenadas del polígono, no datos personales del usuario.</li>
            <li><b>Copernicus Data Space Ecosystem (CDSE, Unión Europea)</b>: procesamiento de imágenes Sentinel-2. Mismo principio: solo coordenadas.</li>
            <li><b>Open-Meteo</b>: pronóstico meteorológico. Se les envían las coordenadas, no datos personales.</li>
            <li><b>Google (Workspace)</b>: envío del informe diario y emails transaccionales mediante SMTP autenticado.</li>
            <li><b>Servidor de hospedaje (VPS en territorio UE)</b>: donde reside la base de datos y la aplicación.</li>
          </ul>
          <p className="mt-3">
            Todos ellos actúan como encargados del tratamiento bajo el marco del
            RGPD. No se realizan transferencias internacionales fuera de la UE
            de datos personales identificativos.
          </p>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 06 · Cuánto tiempo conservamos los datos</h2>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><b>Datos de la cuenta</b>: mientras la cuenta esté activa, más 4 años tras la baja para cumplir con obligaciones legales (registros PAC y fiscales).</li>
            <li><b>Datos satelitales históricos</b>: hasta 5 años para mantener el contexto histórico de cada parcela, valor diferencial del Servicio.</li>
            <li><b>Logs técnicos</b>: 90 días.</li>
          </ul>
          <p className="mt-3">
            Si el usuario solicita explícitamente el borrado anterior al plazo
            legal, se ejecuta sobre los datos que no sean de conservación
            obligatoria.
          </p>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 07 · Derechos del usuario</h2>
          <p>El usuario puede ejercer en cualquier momento los siguientes derechos:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><b>Acceso</b>: solicitar copia de los datos que tenemos sobre él.</li>
            <li><b>Rectificación</b>: corregir datos inexactos.</li>
            <li><b>Supresión</b> (&laquo;derecho al olvido&raquo;): eliminar la cuenta y sus datos asociados, con las limitaciones legales del § 06.</li>
            <li><b>Limitación</b>: pausar el tratamiento mientras se resuelve una controversia.</li>
            <li><b>Portabilidad</b>: recibir sus datos en formato estructurado (JSON / GeoJSON) para llevárselos a otro proveedor.</li>
            <li><b>Oposición</b>: oponerse a tratamientos basados en interés legítimo.</li>
            <li><b>Reclamación ante la AEPD</b>: si considera que su solicitud no ha sido atendida adecuadamente.</li>
          </ul>
          <p className="mt-3">
            Para ejercer cualquiera de estos derechos, escribe a{' '}
            <a href="mailto:juang@systemrapid.io" className="text-agrom-deep underline">
              juang@systemrapid.io
            </a>{' '}
            indicando claramente cuál ejerces. Respondemos en un plazo máximo de 30 días.
          </p>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 08 · Cookies</h2>
          <p>
            FitoLink utiliza únicamente cookies técnicas estrictamente necesarias
            para el funcionamiento de la sesión (token de autenticación). No
            usamos cookies de análisis, publicidad ni redes sociales. No
            compartimos tu actividad con plataformas de tracking.
          </p>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 09 · Seguridad</h2>
          <p>
            Los datos se transmiten cifrados en tránsito (HTTPS/TLS) y se
            almacenan en una base de datos con acceso restringido a personal
            técnico autorizado de AgroM. Las contraseñas no se almacenan — la
            autenticación se realiza mediante Google OAuth.
          </p>
          <p>
            En caso de brecha de seguridad que pudiera afectar a tus datos, te
            informaremos sin demora indebida según establece el RGPD.
          </p>

          <h2 className="font-display text-2xl text-agrom-deep mt-10 mb-3">§ 10 · Cambios en esta política</h2>
          <p>
            Si modificamos esta política, te avisaremos por email con al menos
            30 días de antelación cuando los cambios sean sustanciales.
          </p>
        </section>

        <div className="mt-16 border-t border-agrom-rule/40 pt-6 flex justify-between items-center text-sm">
          <Link to="/terms" className="text-agrom-deep hover:underline">
            ← Términos y condiciones
          </Link>
          <Link to="/" className="text-agrom-deep hover:underline">
            Volver al inicio →
          </Link>
        </div>
      </main>

      <footer className="border-t border-agrom-rule/40 bg-white mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agrom-muted">
            AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN · 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
