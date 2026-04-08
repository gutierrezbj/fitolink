import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toast } from '@/stores/toastStore.js';

type Parcel = { _id: string; name: string; cropType: string; province: string; areaHa?: number };

type Service = {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  description: string;
  duration: string;
  priceRange: string;
  tags: string[];
  highlight?: boolean;
  dji?: boolean;
};

const SERVICES: Service[] = [
  {
    id: 'inspection',
    icon: '📡',
    name: 'Mapeo Multiespectral',
    tagline: 'Ve lo que el ojo no ve',
    description: 'Vuelo con dron equipado con cámara multiespectral. Genera índices NDVI, NDRE y RGB con resolución de 5cm/pixel. Identifica zonas de estrés antes de que sean visibles.',
    duration: '2–4h por visita',
    priceRange: '80–150 € / ha',
    tags: ['NDVI', 'NDRE', 'RGB', 'Mapa de estrés'],
    highlight: true,
    dji: true,
  },
  {
    id: 'phytosanitary',
    icon: '💊',
    name: 'Tratamiento Fitosanitario',
    tagline: 'Precisión milimétrica, cero deriva',
    description: 'Aplicación aérea de fungicidas, insecticidas o acaricidas con dron agrícola. Cobertura uniforme, registro de dosis y trazabilidad completa del tratamiento.',
    duration: '1–3h por parcela',
    priceRange: '25–60 € / ha',
    tags: ['Fungicida', 'Insecticida', 'Trazabilidad', 'ROPO'],
    dji: true,
  },
  {
    id: 'herbicide',
    icon: '🌿',
    name: 'Tratamiento Herbicida',
    tagline: 'Solo donde hace falta',
    description: 'Aplicación variable de herbicidas basada en mapa de malas hierbas previo. Reduce el uso de producto hasta un 40% respecto a la aplicación convencional.',
    duration: '1–2h por parcela',
    priceRange: '20–50 € / ha',
    tags: ['Dosis variable', 'Ahorro producto', 'Prescripción'],
    dji: true,
  },
  {
    id: 'fertilization',
    icon: '🌱',
    name: 'Abonado Foliar',
    tagline: 'Nutrición directa a la hoja',
    description: 'Aplicación aérea de micronutrientes, bioestimulantes o fertilizantes foliares. Máxima eficiencia de absorción con mínimo impacto en el suelo.',
    duration: '1–3h por parcela',
    priceRange: '25–55 € / ha',
    tags: ['Micronutrientes', 'Bioestimulantes', 'Foliar'],
    dji: true,
  },
  {
    id: 'seeding',
    icon: '🌾',
    name: 'Siembra de Precisión',
    tagline: 'Resiembra rápida y exacta',
    description: 'Resiembra de zonas con fallos de nascencia o parcelas de difícil acceso. El dron deposita la semilla con sistema de dispersión controlado.',
    duration: '2–5h por parcela',
    priceRange: '40–80 € / ha',
    tags: ['Resiembra', 'Cobertura', 'Zonas difíciles'],
    dji: true,
  },
  {
    id: 'diagnosis',
    icon: '🔬',
    name: 'Diagnóstico Agronómico',
    tagline: 'Informe técnico con recomendaciones',
    description: 'Visita de agrónomo certificado combinada con vuelo multiespectral. Obtienes un informe PDF con diagnóstico del cultivo, causas probables y plan de acción.',
    duration: '1 día + informe 48h',
    priceRange: '200–400 € / visita',
    tags: ['Informe PDF', 'Plan de acción', 'Agrónomo certificado'],
  },
];

function ServiceCard({ service, onRequest }: { service: Service; onRequest: (s: Service) => void }) {
  return (
    <div className={`bg-white rounded-2xl border ${service.highlight ? 'border-brand-300 shadow-md ring-1 ring-brand-100' : 'border-gray-200'} p-6 flex flex-col relative overflow-hidden`}>
      {service.highlight && (
        <div className="absolute top-3 right-3 bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Más solicitado
        </div>
      )}
      {service.dji && (
        <div className="absolute top-3 left-3 bg-gray-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <span>DJI</span>
          <span className="text-gray-400">·</span>
          <span className="text-[8px]">Trazabilidad automática</span>
        </div>
      )}

      <div className="mt-4 mb-3">
        <span className="text-4xl">{service.icon}</span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-0.5">{service.name}</h3>
      <p className="text-sm text-brand-600 font-medium mb-3">{service.tagline}</p>
      <p className="text-sm text-gray-500 leading-relaxed flex-1">{service.description}</p>

      <div className="flex flex-wrap gap-1.5 mt-4">
        {service.tags.map(tag => (
          <span key={tag} className="text-[10px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{service.duration}</p>
          <p className="text-sm font-bold text-gray-800">{service.priceRange}</p>
        </div>
        <button
          onClick={() => onRequest(service)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            service.highlight
              ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow-md'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          Solicitar →
        </button>
      </div>
    </div>
  );
}

function RequestModal({
  service,
  parcels,
  onClose,
  onSubmit,
  loading,
}: {
  service: Service;
  parcels: Parcel[];
  onClose: () => void;
  onSubmit: (parcelId: string, notes: string) => void;
  loading: boolean;
}) {
  const [parcelId, setParcelId] = useState(parcels[0]?._id || '');
  const [notes, setNotes] = useState('');

  const selectedParcel = parcels.find(p => p._id === parcelId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{service.icon}</span>
              <div>
                <h2 className="font-bold text-gray-900">{service.name}</h2>
                <p className="text-sm text-brand-600">{service.tagline}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Parcel selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ¿En qué parcela?
            </label>
            {parcels.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">No tienes parcelas registradas aún.</p>
            ) : (
              <div className="space-y-2">
                {parcels.map(p => (
                  <button
                    key={p._id}
                    onClick={() => setParcelId(p._id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                      parcelId === p._id
                        ? 'border-brand-400 bg-brand-50 text-brand-800'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.cropType} · {p.province}{p.areaHa ? ` · ${p.areaHa.toFixed(1)} ha` : ''}</p>
                    </div>
                    {parcelId === p._id && <span className="text-brand-600 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notas para el piloto <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Ej: zona norte con mayor incidencia, acceso por camino lateral..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
            />
          </div>

          {/* Summary */}
          {selectedParcel && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 space-y-0.5">
              <p>📍 <span className="font-medium text-gray-700">{selectedParcel.name}</span> · {selectedParcel.province}</p>
              <p>🛸 Servicio: <span className="font-medium text-gray-700">{service.name}</span></p>
              <p>💶 Orientativo: <span className="font-medium text-gray-700">{service.priceRange}</span></p>
              {service.dji && <p>📲 Trazabilidad DJI automática incluida</p>}
            </div>
          )}
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => parcelId && onSubmit(parcelId, notes)}
            disabled={!parcelId || loading}
            className="flex-1 bg-brand-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Confirmar solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [activeService, setActiveService] = useState<Service | null>(null);

  const { data: parcelsData } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => {
      const res = await api.get('/parcels/mine');
      return res.data.data as Parcel[];
    },
  });

  const requestMutation = useMutation({
    mutationFn: async ({ serviceId, parcelId, notes }: { serviceId: string; parcelId: string; notes: string }) => {
      await api.post('/operations', { type: serviceId, parcelId, notes });
    },
    onSuccess: () => {
      toast.success('Solicitud enviada — te asignaremos un piloto en breve');
      setActiveService(null);
    },
    onError: () => toast.error('Error al enviar la solicitud'),
  });

  const parcels = parcelsData || [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Servicios FitoLink</h1>
          <span className="bg-brand-50 text-brand-700 border border-brand-200 text-xs font-semibold px-2.5 py-1 rounded-full">
            Powered by DJI
          </span>
        </div>
        <p className="text-gray-500 text-sm max-w-xl">
          Solicita cualquier servicio directamente desde aquí. Un operador certificado de nuestra red te contactará en menos de 24h para coordinar la visita.
        </p>
      </div>

      {/* DJI banner */}
      <div className="bg-gray-900 text-white rounded-2xl p-5 mb-8 flex items-center gap-5">
        <div className="text-4xl shrink-0">🚁</div>
        <div className="flex-1">
          <p className="font-bold text-sm">Trazabilidad automática con DJI Cloud API</p>
          <p className="text-gray-400 text-xs mt-0.5">
            Todos los operadores de la red usan drones DJI certificados. Cuando el piloto completa el vuelo, los datos (área tratada, dosis, track GPS) se sincronizan automáticamente en tu parcela. Sin papeleo.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">FitoLink</p>
          <p className="text-xs font-bold">DJI Developer Partner</p>
        </div>
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {SERVICES.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            onRequest={setActiveService}
          />
        ))}
      </div>

      {/* Request modal */}
      {activeService && (
        <RequestModal
          service={activeService}
          parcels={parcels}
          onClose={() => setActiveService(null)}
          onSubmit={(parcelId, notes) =>
            requestMutation.mutate({ serviceId: activeService.id, parcelId, notes })
          }
          loading={requestMutation.isPending}
        />
      )}
    </div>
  );
}
