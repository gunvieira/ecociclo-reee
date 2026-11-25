import React, { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertCircle, LocateFixed, X } from 'lucide-react';
import {
  CollectionPoint,
  CollectionPointInput,
  LONDRINA_CENTER,
  ProductCategory,
  WASTE_SHORT_LABELS,
} from '../types';
import { ClickToPick, FlyToLocation, InvalidateSizeOnMount } from './map/MapHelpers';

interface CollectionPointFormModalProps {
  isOpen: boolean;
  editing: CollectionPoint | null;
  onClose: () => void;
  onSave: (input: CollectionPointInput) => Promise<void>;
}

const inputClass =
  'w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20';

// RF12 — formulário de cadastro/edição de ponto de coleta pelo gestor
export const CollectionPointFormModal: React.FC<CollectionPointFormModalProps> = ({
  isOpen,
  editing,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Londrina - PR');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [wasteTypes, setWasteTypes] = useState<ProductCategory[]>([]);
  const [openingHours, setOpeningHours] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name || '');
    setAddress(editing?.address || '');
    setCity(editing?.city || 'Londrina - PR');
    setLat(editing ? String(editing.latitude) : '');
    setLng(editing ? String(editing.longitude) : '');
    setWasteTypes(editing?.acceptedWasteTypes || []);
    setOpeningHours(editing?.openingHours || '');
    setPhone(editing?.phone || '');
    setDescription(editing?.description || '');
    setIsActive(editing ? editing.isActive : true);
    setFlyTarget(null);
    setError(null);
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const hasCoords = lat !== '' && lng !== '' && Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const pickedPos: [number, number] | null = hasCoords ? [parsedLat, parsedLng] : null;

  const pickLocation = (newLat: number, newLng: number) => {
    setLat(newLat.toFixed(6));
    setLng(newLng.toFixed(6));
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('Seu navegador não suporta geolocalização.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pickLocation(pos.coords.latitude, pos.coords.longitude);
        setFlyTarget([pos.coords.latitude, pos.coords.longitude]);
      },
      () => setError('Não foi possível obter sua localização. Clique no mapa para marcar o ponto.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleWaste = (type: ProductCategory) => {
    setWasteTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pickedPos) {
      setError('Marque a localização do ponto clicando no mapa ou usando sua localização.');
      return;
    }
    if (wasteTypes.length === 0) {
      setError('Selecione ao menos um tipo de resíduo aceito.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name,
        address,
        city,
        latitude: pickedPos[0],
        longitude: pickedPos[1],
        acceptedWasteTypes: wasteTypes,
        openingHours,
        phone,
        description,
        isActive,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar ponto de coleta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {editing ? 'Editar Ponto de Coleta' : 'Novo Ponto de Coleta'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do ponto *
              </label>
              <input
                required
                minLength={3}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Cooperativa Recicla Londrina"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço *</label>
              <input
                required
                minLength={5}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número e bairro"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horário de funcionamento
              </label>
              <input
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="Ex.: Seg a Sex, 08h às 17h"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(43) 0000-0000"
                className={inputClass}
              />
            </div>
          </div>

          {/* Localização no mapa */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Localização * — clique no mapa para marcar
              </label>
              <button
                type="button"
                onClick={useMyLocation}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Usar minha localização
              </button>
            </div>
            <div className="relative isolate z-0 h-56 rounded-xl overflow-hidden border border-slate-300">
              <MapContainer
                center={pickedPos || LONDRINA_CENTER}
                zoom={pickedPos ? 15 : 12}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <InvalidateSizeOnMount />
                <ClickToPick onPick={pickLocation} />
                <FlyToLocation target={flyTarget} zoom={16} />
                {pickedPos && (
                  <CircleMarker
                    center={pickedPos}
                    radius={11}
                    pathOptions={{ color: '#065f46', fillColor: '#f59e0b', fillOpacity: 0.95, weight: 2 }}
                  />
                )}
              </MapContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {pickedPos
                ? `Coordenadas: ${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)}`
                : 'Nenhuma localização marcada ainda.'}
            </p>
          </div>

          {/* RF05 — tipos de resíduo aceitos */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipos de resíduo aceitos *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(WASTE_SHORT_LABELS) as ProductCategory[]).map((type) => (
                <label
                  key={type}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                    wasteTypes.includes(type)
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={wasteTypes.includes(type)}
                    onChange={() => toggleWaste(type)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                  />
                  {WASTE_SHORT_LABELS[type]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações para o cidadão
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Entrar pelo portão lateral. Não recebemos geladeiras."
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            />
            Ponto ativo (visível no mapa para os cidadãos)
          </label>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm"
            >
              {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Ponto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
