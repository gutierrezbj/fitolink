import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import ParcelMap from './ParcelMap.js';
import NdviChart from './NdviChart.js';

export default function ParcelsPage() {
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);

  const { data: parcelsData, isLoading } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => {
      const res = await api.get('/parcels/mine');
      return res.data.data;
    },
  });

  const parcels = parcelsData || [];
  const selectedParcel = parcels.find((p: { _id: string }) => p._id === selectedParcelId);

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500">Cargando parcelas...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Parcelas</h1>
          <p className="text-gray-500 text-sm mt-1">{parcels.length} parcelas registradas</p>
        </div>
        <a
          href="/dashboard/parcels/new"
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + Nueva Parcela
        </a>
      </div>

      {/* Map */}
      <div className="mb-6">
        <ParcelMap
          parcels={parcels}
          selectedParcelId={selectedParcelId || undefined}
          onParcelClick={setSelectedParcelId}
          height="400px"
        />
      </div>

      {/* Parcel list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-1 space-y-3">
          {parcels.map((parcel: {
            _id: string;
            name: string;
            cropType: string;
            areaHa: number;
            province: string;
            ndviHistory: Array<{ mean: number; anomalyDetected: boolean }>;
          }) => {
            const latestNdvi = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
            const isSelected = parcel._id === selectedParcelId;

            return (
              <button
                key={parcel._id}
                onClick={() => setSelectedParcelId(parcel._id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected ? 'border-brand-500 bg-brand-50' : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900">{parcel.name}</h3>
                  {latestNdvi?.anomalyDetected && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Alerta</span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {parcel.cropType} · {parcel.areaHa} ha · {parcel.province}
                </div>
                {latestNdvi && (
                  <div className="mt-2 text-xs">
                    <span className={`font-medium ${latestNdvi.mean > 0.6 ? 'text-green-600' : latestNdvi.mean > 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                      NDVI: {latestNdvi.mean.toFixed(2)}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {selectedParcel ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedParcel.name}</h2>
              <p className="text-gray-500 text-sm mb-4">
                {selectedParcel.cropType} · {selectedParcel.areaHa} ha · {selectedParcel.province}
                {selectedParcel.sigpacRef && ` · SIGPAC: ${selectedParcel.sigpacRef}`}
              </p>

              <h3 className="text-sm font-semibold text-gray-700 mb-3">Evolucion NDVI</h3>
              {selectedParcel.ndviHistory?.length > 0 ? (
                <NdviChart data={selectedParcel.ndviHistory} />
              ) : (
                <p className="text-gray-400 text-sm">Sin datos NDVI disponibles aun</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
              Selecciona una parcela para ver su detalle
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
