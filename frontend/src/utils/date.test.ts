import { describe, expect, it } from 'vitest';
import { formatDateBr, toLocalIsoDate } from './date';

describe('formatDateBr', () => {
  it('converte AAAA-MM-DD para DD/MM/AAAA', () => {
    expect(formatDateBr('2024-03-09')).toBe('09/03/2024');
  });

  it('devolve o valor original quando não está no formato esperado', () => {
    expect(formatDateBr('')).toBe('');
    expect(formatDateBr('09/03/2024')).toBe('09/03/2024');
  });
});

describe('toLocalIsoDate', () => {
  it('usa o dia local, e não o dia em UTC', () => {
    // 23h do dia 15 no horário local: em UTC (Brasil, UTC-3) já seria dia 16
    const lateNight = new Date(2024, 0, 15, 23, 30);

    expect(lateNight.toISOString().slice(0, 10)).toBe('2024-01-16'); // o bug que foi corrigido
    expect(toLocalIsoDate(lateNight)).toBe('2024-01-15');
  });

  it('preenche mês e dia com zero à esquerda', () => {
    expect(toLocalIsoDate(new Date(2024, 1, 5))).toBe('2024-02-05');
  });
});
