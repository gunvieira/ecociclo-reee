import { describe, expect, it } from 'vitest';
import { ElectronicProduct } from '../types/models';
import { computeProductLifecycle, enrichProductsWithLifecycle } from './lifecycleService';

// Data de referência fixa: os testes não dependem do dia em que são executados
const REFERENCE_DATE = new Date('2024-06-01T12:00:00Z');

function buildProduct(overrides: Partial<ElectronicProduct> = {}): ElectronicProduct {
  return {
    id: 'p1',
    userId: 'u1',
    name: 'Celular de Teste',
    brand: 'Marca',
    category: 'smartphone',
    purchaseDate: '2024-01-01',
    warrantyMonths: 12,
    estimatedLifespanMonths: 36,
    condition: 'in_use',
    notes: '',
    receipt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const lifecycleOf = (overrides: Partial<ElectronicProduct> = {}) =>
  computeProductLifecycle(buildProduct(overrides), REFERENCE_DATE);

describe('computeProductLifecycle', () => {
  it('produto recente: garantia ativa, vida útil saudável e nenhum alerta', () => {
    const result = lifecycleOf();

    expect(result.warrantyStatus).toBe('active');
    expect(result.warrantyEndDate).toBe('2025-01-01');
    expect(result.warrantyDaysRemaining).toBe(214);
    expect(result.lifespanStatus).toBe('healthy');
    expect(result.lifespanEndDate).toBe('2027-01-01');
    expect(result.lifespanProgressPercent).toBe(14);
    expect(result.alerts).toEqual([]);
  });

  describe('garantia', () => {
    it('gera alerta de aviso quando faltam 30 dias ou menos', () => {
      const result = lifecycleOf({ purchaseDate: '2023-06-15' });

      expect(result.warrantyStatus).toBe('expiring_soon');
      expect(result.warrantyDaysRemaining).toBe(14);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        type: 'warranty_expiring',
        severity: 'warning',
        daysRemaining: 14,
        targetDate: '2024-06-15',
      });
    });

    it('considera "vencendo" a garantia que termina no próprio dia', () => {
      const result = lifecycleOf({ purchaseDate: '2023-06-01' });

      expect(result.warrantyStatus).toBe('expiring_soon');
      expect(result.warrantyDaysRemaining).toBe(0);
      expect(result.alerts[0].message).toContain('vence hoje');
    });

    it('marca como encerrada a garantia vencida, sem gerar alerta de garantia', () => {
      const result = lifecycleOf({ purchaseDate: '2022-01-01' });

      expect(result.warrantyStatus).toBe('expired');
      expect(result.alerts.some((a) => a.type === 'warranty_expiring')).toBe(false);
    });

    it('não alerta sobre garantia quando o produto foi cadastrado sem garantia', () => {
      const result = lifecycleOf({ purchaseDate: '2024-06-01', warrantyMonths: 0 });

      expect(result.alerts.some((a) => a.type === 'warranty_expiring')).toBe(false);
    });
  });

  describe('vida útil', () => {
    it('gera alerta crítico quando a vida útil estimada foi atingida', () => {
      const result = lifecycleOf({
        purchaseDate: '2020-01-01',
        warrantyMonths: 0,
        estimatedLifespanMonths: 36,
      });

      expect(result.lifespanStatus).toBe('reached');
      expect(result.lifespanProgressPercent).toBe(100);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({ type: 'lifespan_reached', severity: 'critical' });
    });

    it('avisa quando faltam 60 dias ou menos para o fim da vida útil', () => {
      const result = lifecycleOf({
        purchaseDate: '2023-06-20',
        warrantyMonths: 0,
        estimatedLifespanMonths: 12,
      });

      expect(result.lifespanStatus).toBe('nearing_end');
      expect(result.lifespanDaysRemaining).toBe(19);
      expect(result.alerts[0]).toMatchObject({ type: 'lifespan_nearing_end', severity: 'warning' });
    });

    it('avisa quando 85% da vida útil já foi consumida, mesmo faltando mais de 60 dias', () => {
      const result = lifecycleOf({
        purchaseDate: '2005-01-01',
        warrantyMonths: 0,
        estimatedLifespanMonths: 240,
      });

      expect(result.lifespanDaysRemaining).toBeGreaterThan(60);
      expect(result.lifespanProgressPercent).toBeGreaterThanOrEqual(85);
      expect(result.lifespanStatus).toBe('nearing_end');
    });
  });

  describe('estado do aparelho', () => {
    it('equipamento com defeito é tratado como fim de vida e gera alerta crítico', () => {
      const result = lifecycleOf({ condition: 'defective' });

      expect(result.lifespanStatus).toBe('reached');
      expect(result.alerts).toContainEqual(
        expect.objectContaining({ type: 'defective_ready_for_disposal', severity: 'critical' })
      );
    });

    it('equipamento parado e saudável gera apenas um lembrete informativo', () => {
      const result = lifecycleOf({ condition: 'idle' });

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toMatchObject({
        id: 'p1-idle-reminder',
        type: 'idle_reminder',
        severity: 'info',
      });
    });
  });

  describe('soma de meses em fim de mês', () => {
    it.each([
      ['2024-01-31', 1, '2024-02-29'], // ano bissexto
      ['2023-01-31', 1, '2023-02-28'],
      ['2024-03-31', 1, '2024-04-30'],
      ['2024-02-29', 12, '2025-02-28'],
      ['2024-08-31', 6, '2025-02-28'], // virada de ano
      ['2024-01-15', 1, '2024-02-15'], // dia comum não é alterado
    ])('compra em %s + %i mês(es) de garantia termina em %s', (purchaseDate, months, expected) => {
      const result = lifecycleOf({ purchaseDate, warrantyMonths: months });

      expect(result.warrantyEndDate).toBe(expected);
    });

    it('aplica a mesma regra ao fim da vida útil', () => {
      const result = lifecycleOf({ purchaseDate: '2023-12-31', estimatedLifespanMonths: 14 });

      expect(result.lifespanEndDate).toBe('2025-02-28');
    });
  });

  it('não ultrapassa 0% para compras com data futura', () => {
    const result = lifecycleOf({ purchaseDate: '2024-12-01' });

    expect(result.lifespanProgressPercent).toBe(0);
  });
});

describe('enrichProductsWithLifecycle', () => {
  it('ordena os alertas por severidade e calcula o resumo do inventário', () => {
    const products = [
      buildProduct({ id: 'parado', condition: 'idle' }),
      buildProduct({ id: 'garantia', purchaseDate: '2023-06-15' }),
      buildProduct({ id: 'defeito', condition: 'defective' }),
      buildProduct({
        id: 'com-nota',
        receipt: {
          fileName: 'nf.png',
          mimeType: 'image/png',
          sizeBytes: 10,
          dataUrl: 'data:image/png;base64,AAAA',
          uploadedAt: '2024-01-01T00:00:00.000Z',
        },
      }),
    ];

    const { items, alerts, summary } = enrichProductsWithLifecycle(products, REFERENCE_DATE);

    expect(items).toHaveLength(4);
    expect(items.every((item) => item.lifecycle)).toBe(true);
    expect(alerts.map((a) => a.severity)).toEqual(['critical', 'warning', 'info']);
    expect(summary).toEqual({
      totalProducts: 4,
      activeWarranties: 4,
      expiringWarranties: 1,
      nearingOrReachedEndOfLife: 1,
      withReceiptCount: 1,
    });
  });

  it('retorna resumo zerado para inventário vazio', () => {
    const { items, alerts, summary } = enrichProductsWithLifecycle([], REFERENCE_DATE);

    expect(items).toEqual([]);
    expect(alerts).toEqual([]);
    expect(summary.totalProducts).toBe(0);
  });
});
