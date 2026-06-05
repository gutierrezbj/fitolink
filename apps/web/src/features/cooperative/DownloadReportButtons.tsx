import { useState } from 'react';
import { api } from '@/lib/api.js';

/**
 * DownloadReportButtons · Bloque B · 05-jun-2026.
 *
 * Botones PDF / CSV de descarga de cartera agregada para roles
 * cooperative / adv / regantes. Endpoint backend genera con pdfkit
 * (PDF) o CSV con BOM UTF-8 para Excel.
 *
 * Mismo componente reusado en CooperativeMembersPage + dashboards
 * agregados para consistencia UX.
 */

export default function DownloadReportButtons() {
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null);

  async function download(format: 'pdf' | 'csv') {
    setDownloading(format);
    try {
      // Axios devuelve el blob crudo · necesitamos responseType:'blob'
      // para que no intente parsear como JSON.
      const res = await api.get('/cooperative/report', {
        params: { format },
        responseType: 'blob',
      });
      // Extraer filename del Content-Disposition header si llega · si no,
      // usar default razonable.
      const disposition = res.headers['content-disposition'] as string | undefined;
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `cartera.${format}`;

      // Descargar blob · createObjectURL + click sintético (mismo
      // patrón que el visor SIGPAC public con KML/GeoJSON).
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('download_report_failed', err);
      alert('No se pudo descargar el reporte. Inténtelo de nuevo en unos segundos.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        type="button"
        onClick={() => download('pdf')}
        disabled={downloading !== null}
        className="inline-flex items-center gap-1.5 bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        title="Descargar cartera en PDF para junta directiva / administración"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {downloading === 'pdf' ? 'Generando…' : 'PDF'}
      </button>
      <button
        type="button"
        onClick={() => download('csv')}
        disabled={downloading !== null}
        className="inline-flex items-center gap-1.5 bg-earth-200 text-brand-900 hover:bg-earth-300 active:bg-earth-400 disabled:opacity-50 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        title="Descargar cartera en CSV para Excel / análisis interno"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {downloading === 'csv' ? 'Generando…' : 'CSV'}
      </button>
    </div>
  );
}
