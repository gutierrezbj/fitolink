import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';

interface ParcelDrawMapProps {
  onPolygonCreated: (geometry: GeoJSON.Polygon, areaHa: number) => void;
  initialGeometry?: GeoJSON.Polygon;
}

function DrawControl({ onPolygonCreated, initialGeometry }: ParcelDrawMapProps) {
  const map = useMap();
  const drawnItems = useRef(new L.FeatureGroup());
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  const onCreated = useCallback((e: L.DrawEvents.Created) => {
    const layer = e.layer as L.Polygon;
    drawnItems.current.addLayer(layer);

    const geoJson = layer.toGeoJSON();

    // Calculate area in hectares
    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    const areaM2 = (L as any).GeometryUtil?.geodesicArea?.(latlngs) || 0;
    const areaHa = Math.round((areaM2 / 10000) * 100) / 100;

    onPolygonCreated(geoJson.geometry as GeoJSON.Polygon, areaHa || 1);

    // Remove draw control after first polygon, add edit-only control
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
    }
    drawControlRef.current = new L.Control.Draw({
      draw: {
        polygon: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
      edit: {
        featureGroup: drawnItems.current,
      },
    });
    map.addControl(drawControlRef.current);
  }, [map, onPolygonCreated]);

  useEffect(() => {
    map.addLayer(drawnItems.current);

    // Load initial geometry if provided
    if (initialGeometry) {
      const layer = L.geoJSON(initialGeometry as GeoJSON.GeoJsonObject);
      layer.eachLayer((l) => drawnItems.current.addLayer(l));
    }

    // Add draw control
    drawControlRef.current = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: initialGeometry ? false : {
          allowIntersection: false,
          shapeOptions: { color: '#22c55e', weight: 2 },
        },
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
      edit: {
        featureGroup: drawnItems.current,
      },
    });
    map.addControl(drawControlRef.current);

    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
      map.removeLayer(drawnItems.current);
    };
  }, [map, initialGeometry]);

  useEffect(() => {
    map.on(L.Draw.Event.CREATED, onCreated as any);
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated as any);
    };
  }, [map, onCreated]);

  return null;
}

export default function ParcelDrawMap({ onPolygonCreated, initialGeometry }: ParcelDrawMapProps) {
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
      <DrawControl onPolygonCreated={onPolygonCreated} initialGeometry={initialGeometry} />
    </MapContainer>
  );
}
