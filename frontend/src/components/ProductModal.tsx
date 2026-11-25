import React, { useEffect, useState } from 'react';
import { X, Upload, FileText, Trash2, AlertCircle } from 'lucide-react';
import {
  CATEGORY_DEFAULT_LIFESPAN,
  CATEGORY_LABELS,
  CONDITION_LABELS,
  ElectronicProduct,
  ProductCategory,
  ProductCondition,
  ReceiptAttachment,
} from '../types';

interface ProductModalProps {
  isOpen: boolean;
  editingProduct: ElectronicProduct | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    brand: string;
    category: ProductCategory;
    purchaseDate: string;
    warrantyMonths: number;
    estimatedLifespanMonths: number;
    condition: ProductCondition;
    notes: string;
    receipt: ReceiptAttachment | null;
  }) => Promise<void>;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  editingProduct,
  onClose,
  onSave,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<ProductCategory>('smartphone');
  const [purchaseDate, setPurchaseDate] = useState(todayIso);
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [estimatedLifespanMonths, setEstimatedLifespanMonths] = useState(36);
  const [condition, setCondition] = useState<ProductCondition>('in_use');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setBrand(editingProduct.brand);
      setCategory(editingProduct.category);
      setPurchaseDate(editingProduct.purchaseDate);
      setWarrantyMonths(editingProduct.warrantyMonths);
      setEstimatedLifespanMonths(editingProduct.estimatedLifespanMonths);
      setCondition(editingProduct.condition);
      setNotes(editingProduct.notes || '');
      setReceipt(editingProduct.receipt || null);
    } else {
      setName('');
      setBrand('');
      setCategory('smartphone');
      setPurchaseDate(todayIso);
      setWarrantyMonths(12);
      setEstimatedLifespanMonths(CATEGORY_DEFAULT_LIFESPAN.smartphone);
      setCondition('in_use');
      setNotes('');
      setReceipt(null);
    }
    setError(null);
  }, [editingProduct, isOpen, todayIso]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: ProductCategory) => {
    setCategory(newCat);
    if (!editingProduct) {
      setEstimatedLifespanMonths(CATEGORY_DEFAULT_LIFESPAN[newCat]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setError('Formato não suportado. Envie PNG, JPG, WEBP ou PDF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('O arquivo da Nota Fiscal deve ter no máximo 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceipt({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          dataUrl: reader.result,
        });
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        name,
        brand,
        category,
        purchaseDate,
        warrantyMonths: Number(warrantyMonths),
        estimatedLifespanMonths: Number(estimatedLifespanMonths),
        condition,
        notes,
        receipt,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar equipamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {editingProduct ? 'Editar Eletrônico' : 'Cadastrar no Inventário Virtual'}
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
                Nome / Modelo do Equipamento *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Smartphone Galaxy S22, Liquidificador Mondial..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex.: Samsung, Dell, LG"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria *</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data da Compra *
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado Atual *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ProductCondition)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((cond) => (
                  <option key={cond} value={cond}>
                    {CONDITION_LABELS[cond]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Garantia (meses)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vida Útil Estimada (meses)
              </label>
              <input
                type="number"
                min={6}
                max={240}
                value={estimatedLifespanMonths}
                onChange={(e) => setEstimatedLifespanMonths(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>

          {/* Upload de Nota Fiscal (RF02) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nota Fiscal — Foto ou PDF
            </label>
            {receipt ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-emerald-950 truncate">
                      {receipt.fileName}
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      {(receipt.sizeBytes / 1024).toFixed(1)} KB anexado
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-100"
                  title="Remover anexo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 cursor-pointer bg-slate-50/70 transition">
                <Upload className="h-5 w-5 text-slate-400 mb-1" />
                <span className="text-xs font-medium text-slate-700">
                  Toque para anexar foto ou PDF da Nota Fiscal
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  PNG, JPG, WEBP ou PDF (máx. 5 MB)
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Número de série, loja da compra ou estado da bateria..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

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
              {saving ? 'Salvando...' : editingProduct ? 'Salvar Alterações' : 'Adicionar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
