import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Edit3,
  FileText,
  LogOut,
  MapPin,
  Navigation,
  PackageOpen,
  Plus,
  Recycle,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AuthPage } from './components/AuthPage';
import { EcopointsView } from './components/EcopointsView';
import { ManagerPanel } from './components/ManagerPanel';
import { ProductModal } from './components/ProductModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { api } from './services/api';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  ElectronicProduct,
  InventorySummary,
  LifecycleAlert,
  ProductCategory,
  ReceiptAttachment,
} from './types';
import { formatDateBr } from './utils/date';

const DashboardView: React.FC = () => {
  const { user, storageMode, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'alerts' | 'ecopoints' | 'manager'>(
    'inventory'
  );
  const [ecopointFilter, setEcopointFilter] = useState<ProductCategory | 'all'>('all');
  const isManager = user?.role === 'manager';

  // Integração Parte 1 → Parte 2: do item no fim da vida útil direto aos ecopontos que o aceitam
  const openEcopointsFor = (category: ProductCategory | 'all') => {
    setEcopointFilter(category);
    setActiveTab('ecopoints');
  };
  const [products, setProducts] = useState<ElectronicProduct[]>([]);
  const [alerts, setAlerts] = useState<LifecycleAlert[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalProducts: 0,
    activeWarranties: 0,
    expiringWarranties: 0,
    nearingOrReachedEndOfLife: 0,
    withReceiptCount: 0,
  });
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [loadingData, setLoadingData] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ElectronicProduct | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<{
    receipt: ReceiptAttachment;
    productName: string;
  } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const loadInventory = useCallback(async () => {
    setLoadingData(true);
    try {
      const data = await api.listInventory();
      setProducts(data.items);
      setAlerts(data.alerts);
      setSummary(data.summary);
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível carregar seu inventário.'));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleSaveProduct = async (payload: Parameters<typeof api.createProduct>[0]) => {
    if (editingProduct) {
      await api.updateProduct(editingProduct.id, payload);
    } else {
      await api.createProduct(payload);
    }
    await loadInventory();
  };

  const handleDeleteProduct = async (product: ElectronicProduct) => {
    const confirmed = window.confirm(
      `Deseja remover "${product.name}" e seus anexos do Inventário Virtual?`
    );
    if (!confirmed) return;
    setActionError(null);
    try {
      await api.deleteProduct(product.id);
      await loadInventory();
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível excluir o equipamento.'));
    }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    setActionError(null);
    try {
      const data = await api.seedDemoProducts();
      setProducts(data.items);
      setAlerts(data.alerts);
      setSummary(data.summary);
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível gerar os exemplos.'));
    } finally {
      setSeeding(false);
    }
  };

  const filteredProducts =
    categoryFilter === 'all'
      ? products
      : products.filter((item) => item.category === categoryFilter);

  const criticalOrWarningCount = alerts.filter((a) => a.severity !== 'info').length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 sm:pb-12">
      {/* Cabeçalho Superior */}
      <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
              <Recycle className="h-5 w-5 text-white" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">EcoCiclo REEE</span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-200 border border-emerald-600/40">
                  {storageMode === 'firebase' ? 'Firebase Cloud' : 'Modo Local Dev'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 truncate">
                Olá, {user?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              Novo Eletrônico
            </button>
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 text-emerald-100"
              title="Sair da conta"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-5 space-y-5">
        {actionError && (
          <div
            role="alert"
            className="rounded-2xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-sm text-red-700"
          >
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <span className="flex-1">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="p-0.5 rounded-md text-red-400 hover:text-red-700"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Cards de Resumo do Ciclo de Vida */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>No Inventário</span>
              <Cpu className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">{summary.totalProducts}</p>
            <p className="text-[11px] text-slate-500">{summary.withReceiptCount} com Nota Fiscal</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Em Garantia</span>
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">{summary.activeWarranties}</p>
            <p className="text-[11px] text-slate-500">
              {summary.expiringWarranties} vencendo em ≤ 30d
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Fim Vida Útil</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">
              {summary.nearingOrReachedEndOfLife}
            </p>
            <p className="text-[11px] text-slate-500">Atenção / Descarte REEE</p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-left hover:border-amber-400 transition"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Alertas Ativos</span>
              <Bell className="h-4 w-4 text-red-500" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">{alerts.length}</p>
            <p className="text-[11px] text-amber-700 font-medium">
              {criticalOrWarningCount > 0
                ? `${criticalOrWarningCount} requer(em) atenção`
                : 'Tudo em dia'}
            </p>
          </button>
        </section>

        {/* Navegação Desktop (em Mobile também aparece barra inferior fixa) */}
        <nav className="hidden sm:flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Inventário Virtual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Alertas Automáticos</span>
            {alerts.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'alerts'
                    ? 'bg-white text-emerald-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {alerts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => openEcopointsFor('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'ecopoints'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Mapa de Ecopontos
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => setActiveTab('manager')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'manager'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Painel do Gestor
            </button>
          )}
        </nav>

        {/* Banner rápido de alertas críticos na aba de Inventário (RF03) */}
        {activeTab === 'inventory' && criticalOrWarningCount > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-amber-950">
                  Você possui {criticalOrWarningCount} alerta(s) importante(s) de ciclo de vida!
                </h2>
                <p className="text-xs text-amber-800 mt-0.5">
                  Há equipamentos com garantia próxima do vencimento ou que já atingiram a vida útil
                  estimada para descarte consciente.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className="self-start sm:self-center shrink-0 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Ver Alertas
            </button>
          </div>
        )}

        {/* ABA 1: INVENTÁRIO VIRTUAL (RF02) */}
        {activeTab === 'inventory' && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                    categoryFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Todos ({products.length})
                </button>
                {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                      categoryFilter === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {loadingData ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                Carregando seu Inventário Virtual...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                  <PackageOpen className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {products.length === 0
                    ? 'Seu Inventário Virtual ainda está vazio'
                    : 'Nenhum eletrônico nesta categoria'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
                  Cadastre seus celulares, notebooks e eletroportáteis para guardar a Nota Fiscal e
                  receber alertas automáticos antes da garantia vencer ou ao fim da vida útil.
                </p>
                <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setModalOpen(true);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Cadastrar Primeiro Eletrônico
                  </button>

                  {products.length === 0 && (
                    <button
                      type="button"
                      disabled={seeding}
                      onClick={handleSeedDemo}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold"
                    >
                      <Sparkles className="h-4 w-4" />
                      {seeding ? 'Gerando exemplos...' : 'Carregar 3 Exemplos de Demonstração'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((product) => {
                  const { lifecycle } = product;
                  const warrantyBadge =
                    lifecycle.warrantyStatus === 'active'
                      ? {
                          label: `Garantia ativa (${lifecycle.warrantyDaysRemaining}d)`,
                          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        }
                      : lifecycle.warrantyStatus === 'expiring_soon'
                      ? {
                          label: `Garantia vence em ${lifecycle.warrantyDaysRemaining}d`,
                          cls: 'bg-amber-50 text-amber-800 border-amber-300',
                        }
                      : {
                          label: 'Garantia encerrada',
                          cls: 'bg-slate-100 text-slate-600 border-slate-200',
                        };

                  const progressBarColor =
                    lifecycle.lifespanStatus === 'reached'
                      ? 'bg-red-500'
                      : lifecycle.lifespanStatus === 'nearing_end'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';

                  return (
                    <article
                      key={product.id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                              {CATEGORY_LABELS[product.category]}
                            </span>
                            <h3 className="text-base font-bold text-slate-900 mt-0.5">
                              {product.name}
                            </h3>
                            <p className="text-xs text-slate-500">
                              Marca: {product.brand} • Compra: {formatDateBr(product.purchaseDate)}
                            </p>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${warrantyBadge.cls}`}
                          >
                            {warrantyBadge.label}
                          </span>
                        </div>

                        {/* Barra de Ciclo de Vida Útil (RF03) */}
                        <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-slate-700">
                              Ciclo de Vida Útil ({product.estimatedLifespanMonths} meses)
                            </span>
                            <span className="font-bold text-slate-900">
                              {lifecycle.lifespanProgressPercent}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progressBarColor}`}
                              style={{ width: `${lifecycle.lifespanProgressPercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                            <span>Estado: {CONDITION_LABELS[product.condition]}</span>
                            <span>Fim est.: {formatDateBr(lifecycle.lifespanEndDate)}</span>
                          </div>
                        </div>

                        {product.notes && (
                          <p className="mt-3 text-xs text-slate-600 line-clamp-2">
                            {product.notes}
                          </p>
                        )}

                        {lifecycle.lifespanStatus !== 'healthy' && (
                          <button
                            type="button"
                            onClick={() => openEcopointsFor(product.category)}
                            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            Onde descartar este item?
                          </button>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {product.receipt ? (
                          <button
                            type="button"
                            onClick={() =>
                              setViewingReceipt({
                                receipt: product.receipt!,
                                productName: product.name,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Ver Nota Fiscal
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Sem Nota Fiscal anexada</span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setModalOpen(true);
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            title="Editar equipamento"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Excluir equipamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ABA 2: CENTRAL DE ALERTAS AUTOMÁTICOS (RF03) */}
        {activeTab === 'alerts' && (
          <section className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h2 className="text-base font-bold text-slate-900">
                Alertas Automáticos de Garantia e Vida Útil
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoramento ativo para evitar perda de prazos de garantia e combater a retenção
                doméstica de lixo eletrônico (REEE).
              </p>
            </div>

            {alerts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900">Nenhum alerta pendente!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Seus equipamentos cadastrados estão dentro do período regular de uso.
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const styles =
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-200 text-red-950'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-blue-50 border-blue-200 text-blue-950';

                const badgeStyles =
                  alert.severity === 'critical'
                    ? 'bg-red-600 text-white'
                    : alert.severity === 'warning'
                    ? 'bg-amber-600 text-white'
                    : 'bg-blue-600 text-white';

                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border p-4 flex items-start gap-3.5 ${styles}`}
                  >
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${badgeStyles}`}
                        >
                          {alert.severity === 'critical'
                            ? 'Ação Recomendada'
                            : alert.severity === 'warning'
                            ? 'Atenção ao Prazo'
                            : 'Lembrete'}
                        </span>
                        <span className="text-xs font-semibold opacity-75">
                          {CATEGORY_LABELS[alert.category]}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold mt-1">{alert.title}</h3>
                      <p className="text-xs mt-1 leading-relaxed opacity-90">{alert.message}</p>
                      {(alert.type === 'lifespan_reached' ||
                        alert.type === 'defective_ready_for_disposal') && (
                        <button
                          type="button"
                          onClick={() => openEcopointsFor(alert.category)}
                          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 hover:bg-white border border-current/20 text-xs font-semibold"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Ver ecopontos que aceitam este item
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* ABA 3: MAPA DE ECOPONTOS (RF04 + RF05) */}
        {activeTab === 'ecopoints' && <EcopointsView initialWasteFilter={ecopointFilter} />}

        {/* ABA 4: PAINEL DO GESTOR (RF12) */}
        {activeTab === 'manager' && isManager && <ManagerPanel />}
      </main>

      {/* Botão Flutuante + Barra Inferior Mobile-First (RNF02) */}
      <button
        type="button"
        onClick={() => {
          setEditingProduct(null);
          setModalOpen(true);
        }}
        className="sm:hidden fixed right-4 bottom-20 z-30 h-13 w-13 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-700/30 flex items-center justify-center active:scale-95 transition"
        aria-label="Novo Eletrônico"
      >
        <Plus className="h-6 w-6" />
      </button>

      <nav
        className={`sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid ${
          isManager ? 'grid-cols-4' : 'grid-cols-3'
        } py-2 px-2`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${
            activeTab === 'inventory' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <Cpu className="h-5 w-5" />
          <span>Inventário</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${
            activeTab === 'alerts' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <Bell className="h-5 w-5" />
          <span>Alertas</span>
          {alerts.length > 0 && (
            <span className="absolute top-0.5 right-6 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {alerts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => openEcopointsFor('all')}
          className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${
            activeTab === 'ecopoints' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <MapPin className="h-5 w-5" />
          <span>Ecopontos</span>
        </button>

        {isManager && (
          <button
            type="button"
            onClick={() => setActiveTab('manager')}
            className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${
              activeTab === 'manager' ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            <Building2 className="h-5 w-5" />
            <span>Gestor</span>
          </button>
        )}
      </nav>

      <ProductModal
        isOpen={modalOpen}
        editingProduct={editingProduct}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveProduct}
      />

      <ReceiptViewerModal
        receipt={viewingReceipt?.receipt || null}
        productName={viewingReceipt?.productName || ''}
        onClose={() => setViewingReceipt(null)}
      />
    </div>
  );
};

const RootGate: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Carregando EcoCiclo REEE...
      </div>
    );
  }

  return user ? <DashboardView /> : <AuthPage />;
};

export const App: React.FC = () => (
  <AuthProvider>
    <RootGate />
  </AuthProvider>
);

export default App;
