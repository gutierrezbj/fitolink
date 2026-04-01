import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';

export interface NdviPoint {
  lat: number;
  lng: number;
  ndvi: number;
}

export interface NdviSnapshot {
  _id: string;
  parcelId: string;
  date: string;
  resolution: number;
  points: NdviPoint[];
  bbox: [number, number, number, number]; // [west, south, east, north]
  pixelCount: number;
}

export function useNdviSnapshot(parcelId: string | undefined) {
  return useQuery<NdviSnapshot | null>({
    queryKey: ['ndvi-snapshot', parcelId],
    queryFn: async () => {
      const res = await api.get(`/parcels/${parcelId}/ndvi-snapshot`);
      return res.data.data ?? null;
    },
    enabled: !!parcelId,
    staleTime: 5 * 60 * 1000,
  });
}
