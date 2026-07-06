import { useState } from 'react';
import { toast } from '@/stores/toastStore.js';
import {
  downloadKmz,
  shareOrDownloadKmz,
  canShareFiles,
  slugify,
  type ParcelForExport,
} from '@/lib/kmzExport.js';

type Props = {
  /** Una parcela (detalle) o varias (lista). Solo se exportan las que tienen contorno. */
  parcels: ParcelForExport[];
  /** Base del nombre de fichero, sin extensión (se slugifica). */
  filenameBase: string;
  /** Nombre del documento dentro del KMZ (title en Google Earth). */
  docName: string;
  /** Tamaño compacto para el header del detalle de parcela. */
  compact?: boolean;
};

// Botones "Descargar KMZ" (+ "Compartir" en móvil) para llevar el contorno de
// la(s) parcela(s) al mando del dron DJI sin salir de FitoLink. Todo cliente.
export default function ParcelExportButtons({ parcels, filenameBase, docName, compact }: Props) {
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);

  const valid = parcels.filter(
    (p) => p.geometry && (p.geometry.type === 'Polygon' || p.geometry.type === 'MultiPolygon'),
  );
  const disabled = valid.length === 0;
  const filename = `${slugify(filenameBase)}.kmz`;
  const showShare = canShareFiles();

  async function onDownload() {
    if (disabled) return;
    setBusy('download');
    try {
      await downloadKmz(valid, filename, docName);
    } catch (err) {
      console.error('kmz_download_failed', err);
      toast.error('No se pudo generar el KMZ');
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    if (disabled) return;
    setBusy('share');
    try {
      const text = `${docName} · KMZ para cargar en el dron — AgroM · FitoLink`;
      const res = await shareOrDownloadKmz(valid, filename, docName, text);
      if (res === 'downloaded') toast.info('Tu dispositivo no permite compartir el archivo; se ha descargado');
    } catch (err) {
      console.error('kmz_share_failed', err);
      toast.error('No se pudo compartir el KMZ');
    } finally {
      setBusy(null);
    }
  }

  const size = compact ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        type="button"
        onClick={onDownload}
        disabled={disabled || busy !== null}
        title={disabled ? 'Esta parcela no tiene contorno' : 'Descargar KMZ para el dron'}
        className={`inline-flex items-center gap-1.5 bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 rounded-lg font-medium transition-colors ${size}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {busy === 'download' ? 'Generando…' : 'KMZ'}
      </button>
      {showShare && (
        <button
          type="button"
          onClick={onShare}
          disabled={disabled || busy !== null}
          title="Compartir KMZ"
          className={`inline-flex items-center gap-1.5 bg-earth-200 text-brand-900 hover:bg-earth-300 active:bg-earth-400 disabled:opacity-50 rounded-lg font-medium transition-colors ${size}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          {busy === 'share' ? '…' : 'Compartir'}
        </button>
      )}
    </div>
  );
}
