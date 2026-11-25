import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  Clock,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
} from 'lucide-react';
import { api } from '../services/api';
import {
  CATEGORY_LABELS,
  CollectionPoint,
  LONDRINA_CENTER,
  ProductCategory,
  WASTE_SHORT_LABELS,
} from '../types';
import { directionsUrl, formatDistance, haversineKm } from '../utils/geo';
import { FlyToLocation } from './map/MapHelpers';

type GeoStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported';

interface EcopointsViewProps {
  initialWasteFilter?: ProductCategory | 'all';
}

// RF04 (mapa + geolocalização) e RF05 (filtro por tipo de resíduo)
export const EcopointsView: React.FC<EcopointsViewProps> = ({ initialWasteFilter = 'all' }) => {
  const [points, setPoints] = useState<CollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wasteFilter, setWasteFilter] = useState<ProductCategory | 'all'>(initialWasteFilter);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  useEffect(() => {
    setWasteFilter(initialWasteFilter);
  }, [initialWasteFilter]);

  useEffect(() => {
    let cancelled = false;
    api
      .listCollectionPoints()
      .then((res) => {
        if (!cancelled) setPoints(res.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar pontos de coleta.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // HTML5 Geolocation API — sem custo e nativa do navegador
  const locateUser = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
        setFlyTarget(coords);
        setGeoStatus('granted');
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    locateUser();
  }, [locateUser]);

  const visiblePoints = useMemo(
    () =>
      points
        .filter(
          (p) =>
            p.isActive && (wasteFilter === 'all' || p.acceptedWasteTypes.includes(wasteFilter))
        )
        .map((p) => ({
          ...p,
          distanceKm: userPos ? haversineKm(userPos, [p.latitude, p.longitude]) : null,
        }))
        .sort((a, b) =>
          a.distanceKm !== null && b.distanceKm !== null
            ? a.distanceKm - b.distanceKm
            : a.name.localeCompare(b.name)
        ),
    [points, wasteFilter, userPos]
  );

  const selectPoint = (point: CollectionPoint) => {
    setSelectedId(point.id);
    setFlyTarget([point.latitude, point.longitude]);
  };

  const geoMessage: Record<GeoStatus, string> = {
    idle: 'Localização ainda não solicitada.',
    locating: 'Obtendo sua localização...',
    granted: 'Pontos ordenados pela distância até você.',
    denied: 'Permissão de localização negada — mostrando o mapa de Londrina.',
    unsupported: 'Seu navegador não suporta geolocalização.',
  };

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Mapa de Pontos de Coleta de REEE (RF04)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{geoMessage[geoStatus]}</p>
        </div>
        <button
          type="button"
          onClick={locateUser}
          disabled={geoStatus === 'locating'}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold"
        >
          <LocateFixed className="h-4 w-4" />
          {geoStatus === 'locating' ? 'Localizando...' : 'Usar minha localização'}
        </button>
      </div>

      {/* RF05 — Filtro por tipo de resíduo aceito */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setWasteFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
            wasteFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          Todos os resíduos
        </button>
        {(Object.keys(WASTE_SHORT_LABELS) as ProductCategory[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setWasteFilter(type)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              wasteFilter === type
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {WASTE_SHORT_LABELS[type]}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* "isolate z-0" impede que as camadas do Leaflet fiquem sobre o cabeçalho e os modais */}
        <div className="lg:col-span-3 relative isolate z-0 rounded-2xl overflow-hidden border border-slate-200 h-[320px] sm:h-[460px] bg-slate-100">
          <MapContainer
            center={LONDRINA_CENTER}
            zoom={12}
            scrollWheelZoom
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToLocation target={flyTarget} zoom={14} />

            {userPos && (
              <CircleMarker
                center={userPos}
                radius={9}
                pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 3 }}
              >
                <Popup>Você está aqui</Popup>
              </CircleMarker>
            )}

            {visiblePoints.map((point) => (
              <CircleMarker
                key={point.id}
                center={[point.latitude, point.longitude]}
                radius={selectedId === point.id ? 13 : 10}
                eventHandlers={{ click: () => setSelectedId(point.id) }}
                pathOptions={{
                  color: '#065f46',
                  fillColor: selectedId === point.id ? '#f59e0b' : '#10b981',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="space-y-1 min-w-[180px]">
                    <p className="font-bold text-slate-900 text-sm">{point.name}</p>
                    <p className="text-xs text-slate-600">{point.address}</p>
                    <p className="text-xs text-slate-600">{point.openingHours}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      {point.acceptedWasteTypes.map((t) => WASTE_SHORT_LABELS[t]).join(' • ')}
                    </p>
                    <a
                      href={directionsUrl(point.latitude, point.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-blue-700"
                    >
                      Traçar rota →
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Lista ordenada por proximidade */}
        <div className="lg:col-span-2 space-y-3 lg:max-h-[460px] lg:overflow-y-auto lg:pr-1">
          <p className="text-xs font-semibold text-slate-500">
            {loading
              ? 'Carregando pontos de coleta...'
              : `${visiblePoints.length} ponto(s) encontrado(s)${
                  wasteFilter !== 'all' ? ` para ${CATEGORY_LABELS[wasteFilter]}` : ''
                }`}
          </p>

          {!loading && visiblePoints.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
              <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                Nenhum ponto aceita este tipo de resíduo ainda.
              </p>
              <p className="text-xs text-slate-500 mt-1">Tente outro filtro de resíduo.</p>
            </div>
          )}

          {visiblePoints.map((point) => (
            <article
              key={point.id}
              className={`bg-white rounded-2xl border p-4 transition ${
                selectedId === point.id
                  ? 'border-amber-400 ring-2 ring-amber-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{point.name}</h3>
                  <p className="text-xs text-slate-500">
                    {point.address} — {point.city}
                  </p>
                </div>
                {point.distanceKm !== null && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200">
                    {formatDistance(point.distanceKm)}
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" /> {point.openingHours}
                </p>
                {point.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {point.phone}
                  </p>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {point.isSample && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                    Exemplo
                  </span>
                )}
                {point.acceptedWasteTypes.map((type) => (
                  <span
                    key={type}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      wasteFilter === type
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {WASTE_SHORT_LABELS[type]}
                  </span>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectPoint(point)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Ver no mapa
                </button>
                <a
                  href={directionsUrl(point.latitude, point.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Rota
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
