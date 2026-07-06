// Exportación de parcelas a KMZ (KML comprimido) para cargar en los mandos de
// dron DJI (Agras). Todo en cliente: reutiliza la geometría GeoJSON que ya
// llega en la parcela + jszip (ya instalado) para comprimir el KML a KMZ.
// Coherente con el visor SIGPAC (mismo estilo de KML 2.2).
import JSZip from 'jszip';

export type ParcelForExport = {
  name: string;
  cropType?: string;
  areaHa?: number;
  sigpacRef?: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

// Anillos exteriores (soporta Polygon y MultiPolygon).
function outerRings(geom: ParcelForExport['geometry']): number[][][] {
  if (geom.type === 'Polygon') return geom.coordinates.length ? [geom.coordinates[0]] : [];
  if (geom.type === 'MultiPolygon') return geom.coordinates.map((poly) => poly[0]).filter(Boolean);
  return [];
}

// lon,lat,alt separado por espacios; anillo cerrado (primer punto = último).
function ringToKmlCoords(ring: number[][]): string {
  const pts = ring.map(([lng, lat]) => `${lng},${lat},0`);
  if (pts.length && pts[0] !== pts[pts.length - 1]) pts.push(pts[0]);
  return pts.join(' ');
}

function placemark(p: ParcelForExport): string {
  const desc = [
    p.cropType,
    p.areaHa != null ? `${p.areaHa} ha` : null,
    p.sigpacRef ? `SIGPAC ${p.sigpacRef}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const rings = outerRings(p.geometry);
  const polys = rings
    .map(
      (ring) => `
      <Polygon>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs><LinearRing>
          <coordinates>${ringToKmlCoords(ring)}</coordinates>
        </LinearRing></outerBoundaryIs>
      </Polygon>`,
    )
    .join('');
  const geom = rings.length > 1 ? `<MultiGeometry>${polys}</MultiGeometry>` : polys;
  return `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>${escapeXml(desc)}</description>
      <styleUrl>#agrom</styleUrl>${geom}
    </Placemark>`;
}

export function buildKml(parcels: ParcelForExport[], docName: string): string {
  // Estilo AgroM (verde). El color es solo para verlo en Google Earth; el DJI
  // usa el contorno, no el estilo. Color KML = aabbggrr.
  const style = `    <Style id="agrom">
      <LineStyle><color>ff2fa02f</color><width>2.2</width></LineStyle>
      <PolyStyle><color>552fa02f</color></PolyStyle>
    </Style>`;
  const body = parcels.map(placemark).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(docName)}</name>
${style}
${body}
  </Document>
</kml>`;
}

export async function buildKmzBlob(parcels: ParcelForExport[], docName: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file('doc.kml', buildKml(parcels, docName));
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.google-earth.kmz',
    compression: 'DEFLATE',
  });
}

// Slug seguro para nombre de fichero. NFD descompone los acentos y el filtro
// alfanumérico se lleva por delante las marcas y los separadores.
export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[^0-9A-Za-z]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'parcelas'
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export async function downloadKmz(parcels: ParcelForExport[], filename: string, docName: string): Promise<void> {
  const blob = await buildKmzBlob(parcels, docName);
  triggerDownload(blob, filename);
}

// ¿El navegador puede compartir FICHEROS por el share nativo? (móvil, sobre
// todo). En escritorio suele ser false → ahí solo mostramos "Descargar".
export function canShareFiles(): boolean {
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof navigator.share !== 'function' || typeof nav.canShare !== 'function') return false;
    const probe = new File(['x'], 'probe.kmz', { type: 'application/vnd.google-earth.kmz' });
    return nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// Comparte el KMZ por el share nativo; si el dispositivo no puede, descarga.
export async function shareOrDownloadKmz(
  parcels: ParcelForExport[],
  filename: string,
  docName: string,
  shareText: string,
): Promise<'shared' | 'downloaded'> {
  const blob = await buildKmzBlob(parcels, docName);
  const file = new File([blob], filename, { type: 'application/vnd.google-earth.kmz' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: docName, text: shareText });
      return 'shared';
    } catch (err) {
      // Cancelado por el usuario → no hacemos fallback (lo cerró a propósito).
      if ((err as DOMException)?.name === 'AbortError') return 'shared';
      // Otro error → cae a descarga.
    }
  }
  triggerDownload(blob, filename);
  return 'downloaded';
}
