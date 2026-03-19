import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { formatDate } from '@/lib/utils.js';
import { useState } from 'react';
import CompleteOperationForm from '@/features/pilot/CompleteOperationForm.js';

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
  inspection: 'Inspeccion',
  diagnosis: 'Diagnostico',
};

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
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      >
        &larr; Volver
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[op.status] || 'bg-gray-100'}`}>
                {STATUS_LABELS[op.status] || op.status}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {TYPE_LABELS[op.type] || op.type}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Operacion: {op.parcelId?.name || 'Parcela'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Creada el {formatDate(op.createdAt)}
              {op.completedAt && ` · Completada el ${formatDate(op.completedAt)}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Parcel info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Parcela</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Nombre</span>
              <span className="text-sm font-medium text-gray-900">{op.parcelId?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Cultivo</span>
              <span className="text-sm font-medium text-gray-900">{op.parcelId?.cropType || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Provincia</span>
              <span className="text-sm font-medium text-gray-900">{op.parcelId?.province || '-'}</span>
            </div>
            {op.parcelId?.areaHa && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Superficie</span>
                <span className="text-sm font-medium text-gray-900">{op.parcelId.areaHa.toFixed(1)} ha</span>
              </div>
            )}
          </div>
        </div>

        {/* People */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {isPilot ? 'Agricultor' : 'Piloto'}
          </h2>
          {isPilot && op.farmerId ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Nombre</span>
                <span className="text-sm font-medium text-gray-900">{op.farmerId.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">{op.farmerId.email}</span>
              </div>
              {op.farmerId.phone && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Telefono</span>
                  <span className="text-sm font-medium text-gray-900">{op.farmerId.phone}</span>
                </div>
              )}
            </div>
          ) : isFarmer && op.pilotId ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Nombre</span>
                <span className="text-sm font-medium text-gray-900">{op.pilotId.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">{op.pilotId.email}</span>
              </div>
              {op.pilotId.rating > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Valoracion</span>
                  <span className="text-sm font-medium text-gray-900">{op.pilotId.rating.toFixed(1)} / 5</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin asignar</p>
          )}
        </div>

        {/* Alert info */}
        {op.alertId && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Alerta Vinculada</h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Severidad</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[op.alertId.severity] || 'bg-gray-100'}`}>
                  {op.alertId.severity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">NDVI</span>
                <span className="text-sm font-bold text-red-600">{op.alertId.ndviValue?.toFixed(2)}</span>
              </div>
              {op.alertId.ndviDelta != null && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Variacion</span>
                  <span className="text-sm font-medium text-red-500">
                    {op.alertId.ndviDelta > 0 ? '+' : ''}{op.alertId.ndviDelta.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Flight log (completed) */}
        {op.status === 'completed' && op.flightLog && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos de Vuelo</h2>
            <div className="space-y-2">
              {op.flightLog.startTime && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Inicio</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(op.flightLog.startTime)}</span>
                </div>
              )}
              {op.flightLog.endTime && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Fin</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(op.flightLog.endTime)}</span>
                </div>
              )}
              {op.flightLog.areaHa && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Area tratada</span>
                  <span className="text-sm font-medium text-gray-900">{op.flightLog.areaHa} ha</span>
                </div>
              )}
              {op.product && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Producto</span>
                    <span className="text-sm font-medium text-gray-900">{op.product.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Dosis</span>
                    <span className="text-sm font-medium text-gray-900">{op.product.doseLPerHa} L/ha</span>
                  </div>
                </>
              )}
              {op.weatherConditions && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Meteorologia</span>
                  <span className="text-sm font-medium text-gray-900">
                    {op.weatherConditions.temp}°C · {op.weatherConditions.windKmh} km/h · {op.weatherConditions.humidity}%
                  </span>
                </div>
              )}
              {op.applicationMethod && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Metodo</span>
                  <span className="text-sm font-medium text-gray-900">{op.applicationMethod}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
