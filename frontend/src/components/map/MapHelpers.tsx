import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

// Move o mapa suavemente até a coordenada informada
export function FlyToLocation({
  target,
  zoom = 15,
}: {
  target: [number, number] | null;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, zoom, { duration: 0.8 });
    }
  }, [target, zoom, map]);
  return null;
}

// Captura o clique no mapa (usado pelo gestor para marcar a localização do ponto)
export function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

// Corrige o tamanho do mapa quando ele é exibido dentro de modais/animações
export function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}
