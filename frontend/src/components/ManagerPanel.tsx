import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Building2, Clock, Edit3, Eye, EyeOff, MapPin, Plus, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { CollectionPoint, CollectionPointInput, WASTE_SHORT_LABELS } from '../types';
import { CollectionPointFormModal } from './CollectionPointFormModal';

// RF12 — Painel administrativo para gestores de pontos de coleta
export const ManagerPanel: React.FC = () => {
  const [points, setPoints] = useState<CollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionPoint | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listMyCollectionPoints();
      setPoints(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar seus pontos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (input: CollectionPointInput) => {
    if (editing) {
      await api.updateCollectionPoint(editing.id, input);
    } else {
      await api.createCollectionPoint(input);
    }
    await load();
  };

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
    }
  };

  const handleToggle = (point: CollectionPoint) =>
    runAction(() => api.updateCollectionPoint(point.id, { isActive: !point.isActive }));

  const handleDelete = (point: CollectionPoint) => {
    if (!window.confirm(`Excluir o ponto "${point.name}" do mapa?`)) return;
    runAction(() => api.deleteCollectionPoint(point.id));
  };

  const activeCount = points.filter((p) => p.isActive).length;
  const sampleCount = points.filter((p) => p.isSample).length;

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Painel do Gestor de Coleta</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastre e mantenha atualizados os pontos de coleta da sua cooperativa, ONG ou órgão
              público.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Novo Ponto de Coleta
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">Seus pontos</p>
          <p className="text-2xl font-bold text-slate-900">{points.length}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">Ativos no mapa</p>
          <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">De exemplo</p>
          <p className="text-2xl font-bold text-slate-500">{sampleCount}</p>
        </div>
      </div>

      {sampleCount > 0 && (
        <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-xl p-3">
          Os pontos marcados como <strong>Exemplo</strong> são ilustrativos. Edite-os com dados reais
          (ao salvar, eles passam a ser seus) ou exclua-os.
        </p>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Carregando pontos de coleta...
        </div>
      ) : points.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900">Você ainda não cadastrou pontos</h3>
          <p className="text-xs text-slate-500 mt-1">
            Clique em "Novo Ponto de Coleta" para aparecer no mapa dos cidadãos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {points.map((point) => (
            <article
              key={point.id}
              className={`bg-white rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                point.isActive ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{point.name}</h3>
                  <div className="flex gap-1 shrink-0">
                    {point.isSample && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                        Exemplo
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        point.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {point.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {point.address} — {point.city}
                </p>
                <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" /> {point.openingHours}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {point.acceptedWasteTypes.map((type) => (
                    <span
                      key={type}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-semibold"
                    >
                      {WASTE_SHORT_LABELS[type]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => handleToggle(point)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  title={point.isActive ? 'Ocultar do mapa' : 'Exibir no mapa'}
                >
                  {point.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {point.isActive ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(point);
                    setModalOpen(true);
                  }}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  title="Editar ponto"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(point)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Excluir ponto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <CollectionPointFormModal
        isOpen={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </section>
  );
};
