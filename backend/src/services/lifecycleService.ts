import {
  ElectronicProduct,
  LifecycleAlert,
  ProductCategory,
  ProductLifecycleStatus,
  ProductWithLifecycle,
} from '../types/models';

export const DEFAULT_LIFESPAN_MONTHS: Record<ProductCategory, number> = {
  smartphone: 36,
  computer: 60,
  tv_monitor: 72,
  appliance: 48,
  battery_accessory: 24,
  other: 48,
};

// Soma meses limitando ao último dia do mês de destino (31/01 + 1 mês = 28 ou 29/02).
// O setUTCMonth puro "transbordaria" para março.
function addMonthsToIsoDate(isoDate: string, months: number): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const targetMonthIndex = (month || 1) - 1 + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, targetMonthIndex, Math.min(day || 1, lastDayOfTargetMonth)));
}

function parseIsoDateUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function diffInDays(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

export function computeProductLifecycle(
  product: ElectronicProduct,
  referenceDate: Date = new Date()
): ProductLifecycleStatus {
  const todayUtc = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  );

  const purchaseUtc = parseIsoDateUtc(product.purchaseDate);
  const warrantyEndUtc = addMonthsToIsoDate(product.purchaseDate, product.warrantyMonths);
  const lifespanEndUtc = addMonthsToIsoDate(
    product.purchaseDate,
    product.estimatedLifespanMonths
  );

  const warrantyDaysRemaining = diffInDays(todayUtc, warrantyEndUtc);
  const lifespanDaysRemaining = diffInDays(todayUtc, lifespanEndUtc);

  const totalLifespanDays = Math.max(1, diffInDays(purchaseUtc, lifespanEndUtc));
  const elapsedDays = Math.max(0, diffInDays(purchaseUtc, todayUtc));
  const lifespanProgressPercent = Math.min(
    100,
    Math.max(0, Math.round((elapsedDays / totalLifespanDays) * 100))
  );

  let warrantyStatus: ProductLifecycleStatus['warrantyStatus'] = 'active';
  if (warrantyDaysRemaining < 0) {
    warrantyStatus = 'expired';
  } else if (warrantyDaysRemaining <= 30) {
    warrantyStatus = 'expiring_soon';
  }

  let lifespanStatus: ProductLifecycleStatus['lifespanStatus'] = 'healthy';
  if (lifespanDaysRemaining <= 0 || product.condition === 'defective') {
    lifespanStatus = 'reached';
  } else if (lifespanProgressPercent >= 85 || lifespanDaysRemaining <= 60) {
    lifespanStatus = 'nearing_end';
  }

  const alerts: LifecycleAlert[] = [];
  const warrantyEndIso = toIsoDateString(warrantyEndUtc);
  const lifespanEndIso = toIsoDateString(lifespanEndUtc);

  // RF03 - Alerta de produto com defeito / pronto para logística reversa
  if (product.condition === 'defective') {
    alerts.push({
      id: `${product.id}-defective`,
      productId: product.id,
      productName: product.name,
      category: product.category,
      type: 'defective_ready_for_disposal',
      severity: 'critical',
      title: 'Equipamento com defeito — Descarte Consciente',
      message: `O item "${product.name}" está marcado como defeituoso. Caso não haja reparo viável, encaminhe-o a um Ecoponto de REEE (nunca ao lixo comum).`,
      daysRemaining: 0,
      targetDate: toIsoDateString(todayUtc),
    });
  }

  // RF03 - Alertas de Garantia
  if (warrantyStatus === 'expiring_soon' && product.warrantyMonths > 0) {
    alerts.push({
      id: `${product.id}-warranty-expiring`,
      productId: product.id,
      productName: product.name,
      category: product.category,
      type: 'warranty_expiring',
      severity: 'warning',
      title: 'Garantia próxima do fim',
      message:
        warrantyDaysRemaining === 0
          ? `A garantia de "${product.name}" vence hoje (${warrantyEndIso}). Verifique o funcionamento e a Nota Fiscal anexada!`
          : `A garantia de "${product.name}" vence em ${warrantyDaysRemaining} dia(s) (${warrantyEndIso}). Acione a assistência caso note falhas.`,
      daysRemaining: warrantyDaysRemaining,
      targetDate: warrantyEndIso,
    });
  }

  // RF03 - Alertas de Vida Útil Estimada
  if (lifespanDaysRemaining <= 0) {
    alerts.push({
      id: `${product.id}-lifespan-reached`,
      productId: product.id,
      productName: product.name,
      category: product.category,
      type: 'lifespan_reached',
      severity: 'critical',
      title: 'Fim da vida útil estimada atingido',
      message: `"${product.name}" atingiu a vida útil estimada (${lifespanEndIso}). Se estiver sem uso ou obsoleto, evite retê-lo em casa e planeje o descarte em um ponto de coleta de REEE.`,
      daysRemaining: lifespanDaysRemaining,
      targetDate: lifespanEndIso,
    });
  } else if (lifespanStatus === 'nearing_end') {
    alerts.push({
      id: `${product.id}-lifespan-nearing`,
      productId: product.id,
      productName: product.name,
      category: product.category,
      type: 'lifespan_nearing_end',
      severity: 'warning',
      title: 'Aproximando-se do fim da vida útil',
      message: `"${product.name}" já cumpriu ${lifespanProgressPercent}% da vida útil estimada (restam cerca de ${lifespanDaysRemaining} dias). Avalie manutenção preventiva ou futuro descarte responsável.`,
      daysRemaining: lifespanDaysRemaining,
      targetDate: lifespanEndIso,
    });
  } else if (product.condition === 'idle') {
    alerts.push({
      id: `${product.id}-idle-reminder`,
      productId: product.id,
      productName: product.name,
      category: product.category,
      type: 'warranty_expired',
      severity: 'info',
      title: 'Aparelho guardado sem uso',
      message: `"${product.name}" está marcado como parado/reserva. Lembre-se de não acumular eletrônicos sem uso indefinidamente — considere doação ou reciclagem REEE.`,
      daysRemaining: lifespanDaysRemaining,
      targetDate: lifespanEndIso,
    });
  }

  return {
    warrantyEndDate: warrantyEndIso,
    warrantyDaysRemaining,
    warrantyStatus,
    lifespanEndDate: lifespanEndIso,
    lifespanDaysRemaining,
    lifespanProgressPercent,
    lifespanStatus,
    alerts,
  };
}

export function enrichProductsWithLifecycle(
  products: ElectronicProduct[],
  referenceDate: Date = new Date()
): {
  items: ProductWithLifecycle[];
  alerts: LifecycleAlert[];
  summary: {
    totalProducts: number;
    activeWarranties: number;
    expiringWarranties: number;
    nearingOrReachedEndOfLife: number;
    withReceiptCount: number;
  };
} {
  const items: ProductWithLifecycle[] = products.map((product) => ({
    ...product,
    lifecycle: computeProductLifecycle(product, referenceDate),
  }));

  const severityOrder: Record<LifecycleAlert['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  const alerts = items
    .flatMap((item) => item.lifecycle.alerts)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const summary = {
    totalProducts: items.length,
    activeWarranties: items.filter((i) => i.lifecycle.warrantyStatus !== 'expired').length,
    expiringWarranties: items.filter((i) => i.lifecycle.warrantyStatus === 'expiring_soon').length,
    nearingOrReachedEndOfLife: items.filter(
      (i) => i.lifecycle.lifespanStatus === 'nearing_end' || i.lifecycle.lifespanStatus === 'reached'
    ).length,
    withReceiptCount: items.filter((i) => Boolean(i.receipt?.dataUrl)).length,
  };

  return { items, alerts, summary };
}
