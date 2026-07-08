import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { formatDate } from '@/lib/utils.js';
import { toast } from '@/stores/toastStore.js';
import { cropLabel, findCatalogProduct, labelRangeText } from '@fitolink/shared';
import { useState } from 'react';
import CompleteOperationForm from '@/features/pilot/CompleteOperationForm.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';
import DoseCalculatorCard from '@/features/operations/DoseCalculatorCard.js';

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  assigned: 'Asignada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const TYPE_LABELS: Record<string, string> = {
  phytosanitary: 'Fitosanitario',
  inspection: 'Inspección',
  diagnosis: 'Diagnóstico',
  herbicide: 'Herbicida',
  fertilization: 'Fertilización',
  seeding: 'Siembra',
};

// Iconos del set unificado line-icon de AgroM (public/service-*.svg), NO emojis.
const TYPE_ICON: Record<string, string> = {
  phytosanitary: '/service-phytosanitary.svg',
  inspection: '/service-diagnosis.svg',
  diagnosis: '/service-diagnosis.svg',
  herbicide: '/service-herbicide.svg',
  fertilization: '/service-fertilization.svg',
  seeding: '/service-seeding.svg',
};

// Fila etiqueta/valor compacta, reutilizada en las tarjetas de la ficha.
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500 flex-shrink-0">{k}</dt>
      <dd className={`font-medium text-gray-900 text-right truncate ${mono ? 'font-mono text-xs' : ''}`}>{v}</dd>
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};

export default function OperationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const { data: operationData, isLoading } = useQuery({
    queryKey: ['operations', id],
    queryFn: async () => {
      const res = await api.get(`/operations/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/operations/${id}/status`, { status: 'in_progress' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/operations/${id}/status`, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      navigate(-1);
    },
  });

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500">Cargando operacion...</div>;
  }

  if (!operationData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <p className="text-gray-400">Operacion no encontrada</p>
      </div>
    );
  }

  const op = operationData;
  const isPilot = user?.role === 'pilot';
  const isFarmer = user?.role === 'farmer';

  // Productos aplicados: mezcla nueva (products[]) o el producto legacy adaptado.
  const appliedProducts: Array<{ name: string; dose: number; unit: string }> = op.products?.length
    ? op.products
    : op.product
      ? [{ name: op.product.name, dose: op.product.doseLPerHa, unit: 'L/ha' }]
      : [];

  async function handleDownloadReport() {
    setDownloadingReport(true);
    try {
      const res = await api.get(`/operations/${id}/report`, { responseType: 'blob' });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe-aplicacion-${(op.parcelId?.name || 'parcela').replace(/[^0-9A-Za-z]+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch {
      toast.error('No se pudo generar el informe');
    } finally {
      setDownloadingReport(false);
    }
  }

  if (showCompleteForm) {
    return (
      <CompleteOperationForm
        operationId={op._id}
        parcelName={op.parcelId?.name || 'Parcela'}
        areaHa={op.parcelId?.areaHa}
        onCancel={() => setShowCompleteForm(false)}
        onComplete={() => {
          setShowCompleteForm(false);
          queryClient.invalidateQueries({ queryKey: ['operations'] });
        }}
      />
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      >
        &larr; Volver
      </button>

      {/* Header — compacto */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[op.status] || 'bg-gray-100'}`}>
                {STATUS_LABELS[op.status] || op.status}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {TYPE_ICON[op.type] && <img src={TYPE_ICON[op.type]} alt="" className="w-3.5 h-3.5" />}
                {TYPE_LABELS[op.type] || op.type}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 truncate">{op.parcelId?.name || 'Parcela'}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Creada el {formatDate(op.createdAt)}
              {op.completedAt && ` · Aplicada el ${formatDate(op.completedAt)}`}
            </p>
          </div>
          {op.status === 'completed' && (
            <button
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="inline-flex items-center gap-1.5 bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
              title="Descargar informe de aplicación en PDF"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloadingReport ? 'Generando…' : 'Descargar informe'}
            </button>
          )}
        </div>
      </div>

      {/* Foto satélite del recinto — franja ancha, ancla visual de la ficha */}
      {op.parcelId?.geometry && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="h-48 sm:h-56">
            <ParcelMap parcels={[op.parcelId]} height="100%" mapStyle="satellite" colorMode="cultivo" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
        {/* Parcela */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Parcela</h2>
          <dl className="space-y-1.5 text-sm">
            <Row k="Cultivo" v={cropLabel(op.parcelId?.cropType)} />
            <Row k="Provincia" v={op.parcelId?.province || '—'} />
            {op.parcelId?.sigpacRef && <Row k="SIGPAC" v={op.parcelId.sigpacRef} mono />}
            {op.parcelId?.areaHa != null && <Row k="Superficie" v={`${op.parcelId.areaHa.toFixed(2)} ha`} />}
          </dl>
          <p className="mt-auto pt-3 text-[11px] leading-relaxed text-gray-400">
            Recinto georreferenciado con SIGPAC catastral oficial (MAPA).
          </p>
        </div>

        {/* Operador (vista farmer) / Agricultor (vista pilot) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {isPilot ? 'Agricultor' : 'Operador'}
          </h2>
          {isPilot && op.farmerId ? (
            <dl className="space-y-1.5 text-sm">
              <Row k="Nombre" v={op.farmerId.name} />
              <Row k="Email" v={op.farmerId.email} />
              {op.farmerId.phone && <Row k="Teléfono" v={op.farmerId.phone} />}
            </dl>
          ) : isFarmer && op.pilotId ? (
            <div className="flex flex-col flex-1">
              {op.pilotId.company && (
                <div className="flex items-center gap-2.5 mb-3 p-2.5 bg-earth-50 rounded-lg border border-earth-200/60">
                  <img src="/drone-pilot.svg" alt="" className="w-8 h-8 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-brand-800 truncate">{op.pilotId.company}</p>
                    <p className="text-[11px] text-gray-500">Operador de drones certificado · AESA</p>
                  </div>
                </div>
              )}
              <dl className="space-y-1.5 text-sm">
                <Row k="Piloto al mando" v={op.pilotId.name} />
                <Row k="Email" v={op.pilotId.email} />
              </dl>
              <p className="mt-auto pt-3 text-[11px] leading-relaxed text-gray-400">
                AgroM coordina el tratamiento; la aplicación con dron la ejecuta el operador certificado y su piloto.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin asignar</p>
          )}
        </div>

        {/* Aplicación (completada) — productos + condiciones + vuelo */}
        {op.status === 'completed' && op.flightLog && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
            <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Aplicación</h2>
            {appliedProducts.length > 0 && (
              <div className="mb-2.5">
                <p className="text-[11px] text-gray-400 mb-1">Productos aplicados</p>
                <div className="space-y-1.5">
                  {appliedProducts.map((p, i) => {
                    // Dosis registrada vs rango de ETIQUETA del catálogo (si el
                    // producto está catalogado y la unidad coincide con la vía dron).
                    const spec = findCatalogProduct(p.name);
                    const label = spec?.methods.dron && spec.methods.dron.dose.unit === p.unit
                      ? spec.methods.dron.dose
                      : undefined;
                    const inLabel = label ? p.dose >= label.min && p.dose <= label.max : undefined;
                    return (
                      <div key={i}>
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="font-medium text-gray-900 truncate">{p.name}</span>
                          <span className="font-semibold text-brand-700 flex-shrink-0">{p.dose} {p.unit}</span>
                        </div>
                        {label && (
                          <p className={`text-[10px] ${inLabel ? 'text-gray-400' : 'text-amber-700 font-medium'}`}>
                            Etiqueta (dron): {labelRangeText(label)} · {inLabel ? 'dentro de etiqueta' : 'FUERA de etiqueta'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <dl className="space-y-1.5 text-sm border-t border-gray-100 pt-2.5">
              {op.flightLog.areaHa != null && <Row k="Área tratada" v={`${op.flightLog.areaHa} ha`} />}
              {op.weatherConditions && (
                <Row k="Meteo" v={`${op.weatherConditions.temp}°C · ${op.weatherConditions.windKmh} km/h · ${op.weatherConditions.humidity}%`} />
              )}
              {op.applicationMethod && <Row k="Método" v={op.applicationMethod} />}
              {op.flightLog.startTime && <Row k="Vuelo" v={formatDate(op.flightLog.startTime)} />}
            </dl>
          </div>
        )}

        {/* Alerta vinculada */}
        {op.alertId && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
            <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Alerta vinculada</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-gray-500">Severidad</dt>
                <dd className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[op.alertId.severity] || 'bg-gray-100'}`}>{op.alertId.severity}</dd>
              </div>
              {op.alertId.ndviValue != null && <Row k="NDVI" v={op.alertId.ndviValue.toFixed(2)} />}
            </dl>
          </div>
        )}
      </div>

      {/* Mezcla según etiqueta — solo mientras la operación está pendiente de
          volar (assigned/in_progress): producto + ha → totales para cargar el
          dron sin sacar números a ojo. En completadas ya se muestra lo aplicado. */}
      {(op.status === 'assigned' || op.status === 'in_progress') && (
        <div className="mt-4">
          <DoseCalculatorCard defaultAreaHa={op.parcelId?.areaHa} />
        </div>
      )}

      {/* Action buttons */}
      {isPilot && op.status === 'assigned' && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
          >
            {acceptMutation.isPending ? 'Aceptando...' : 'Aceptar asignacion'}
          </button>
          <button
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending}
            className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}

      {isPilot && op.status === 'in_progress' && (
        <div className="mt-6">
          <button
            onClick={() => setShowCompleteForm(true)}
            className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Completar operacion
          </button>
        </div>
      )}
    </div>
  );
}
