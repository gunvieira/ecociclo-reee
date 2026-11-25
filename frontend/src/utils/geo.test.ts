import { describe, expect, it } from 'vitest';
import { directionsUrl, formatDistance, haversineKm } from './geo';

describe('haversineKm', () => {
  it('retorna zero para o mesmo ponto', () => {
    expect(haversineKm([-23.31, -51.16], [-23.31, -51.16])).toBe(0);
  });

  it('calcula a distância entre Londrina e Maringá (~79 km em linha reta)', () => {
    const londrina: [number, number] = [-23.3045, -51.1696];
    const maringa: [number, number] = [-23.4205, -51.9333];

    expect(haversineKm(londrina, maringa)).toBeCloseTo(79, 0);
  });

  it('é simétrica', () => {
    const a: [number, number] = [-23.3, -51.1];
    const b: [number, number] = [-23.5, -51.4];

    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

describe('formatDistance', () => {
  it('usa metros abaixo de 1 km', () => {
    expect(formatDistance(0.4567)).toBe('457 m');
  });

  it('usa km com uma casa decimal e vírgula', () => {
    expect(formatDistance(1)).toBe('1,0 km');
    expect(formatDistance(12.345)).toBe('12,3 km');
  });
});

describe('directionsUrl', () => {
  it('gera link de rota com o destino informado', () => {
    expect(directionsUrl(-23.31, -51.16)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-23.31,-51.16'
    );
  });
});
