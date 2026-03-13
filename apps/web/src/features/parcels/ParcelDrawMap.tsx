import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';

interface ParcelDrawMapProps {
  onPolygonCreated: (geometry: GeoJSON.Polygon, areaHa: number) => void;
  initialGeometry?: GeoJSON.Polygon;
}

export default function ParcelDrawMap({ onPolygonCreated, initialGeometry }: ParcelDrawMapProps) {
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (initialGeometry && featureGroupRef.current) {
      const layer = L.geoJSON(initialGeometry as GeoJSON.GeoJsonObject);
      layer.eachLayer((l) => featureGroupRef.current?.addLayer(l));
      setHasDrawn(true);
    }
  }, [initialGeometry]);

  const handleCreated = (e: L.DrawEvents.Created) => {
    const layer = e.layer as L.Polygon;
    const geoJson = layer.toGeoJSON();

    // Calculate area in hectares
    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    const areaM2 = L.GeometryUtil?.geodesicArea?.(latlngs) || 0;
    const areaHa = Math.round((areaM2 / 10000) * 100) / 100;

    onPolygonCreated(geoJson.geometry as GeoJSON.Polygon, areaHa || 1);
    setHasDrawn(true);
  };

  return (
    <MapContainer
      center={[39.0, -3.5]}
      zoom={7}
      style={{ height: '400px', width: '100%' }}
      className="rounded-xl border border-gray-200"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FeatureGroup ref={featureGroupRef}>
        <EditControl
          position="topright"
          onCreated={handleCreated}
          draw={{
            polygon: !hasDrawn ? {
              allowIntersection: false,
              shapeOptions: { color: '#22c55e', weight: 2 },
            } : false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false,
          }}
          edit={{ edit: true, remove: true }}
        />
      </FeatureGroup>
    </MapContainer>
  );
}
