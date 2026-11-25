import { describe, expect, it } from 'vitest';
import { sanitizeCollectionPointPayload } from './collectionPointService';

const validPayload = {
  name: 'Ecoponto Centro',
  address: 'Rua Sergipe, 100',
  latitude: -23.31,
  longitude: -51.16,
  acceptedWasteTypes: ['smartphone', 'computer'],
};

function expectError(raw: Record<string, unknown>, message: string) {
  const result = sanitizeCollectionPointPayload(raw);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain(message);
}

describe('sanitizeCollectionPointPayload', () => {
  it('aceita um ponto válido e aplica os valores padrão', () => {
    const result = sanitizeCollectionPointPayload(validPayload);

    expect(result).toEqual({
      ok: true,
      data: {
        name: 'Ecoponto Centro',
        address: 'Rua Sergipe, 100',
        city: 'Londrina - PR',
        latitude: -23.31,
        longitude: -51.16,
        acceptedWasteTypes: ['smartphone', 'computer'],
        openingHours: 'Consultar horário no local',
        phone: '',
        description: '',
        isActive: true,
      },
    });
  });

  it('aceita coordenadas enviadas como texto e as arredonda para 6 casas', () => {
    const result = sanitizeCollectionPointPayload({
      ...validPayload,
      latitude: '-23.123456789',
      longitude: '-51.987654321',
    });

    expect(result.ok && [result.data.latitude, result.data.longitude]).toEqual([
      -23.123457, -51.987654,
    ]);
  });

  it('respeita a desativação do ponto', () => {
    const result = sanitizeCollectionPointPayload({ ...validPayload, isActive: false });

    expect(result.ok && result.data.isActive).toBe(false);
  });

  it('descarta tipos de resíduo inválidos e repetidos', () => {
    const result = sanitizeCollectionPointPayload({
      ...validPayload,
      acceptedWasteTypes: ['smartphone', 'smartphone', 'pneu', 42],
    });

    expect(result.ok && result.data.acceptedWasteTypes).toEqual(['smartphone']);
  });

  it('recusa nome e endereço curtos demais', () => {
    expectError({ ...validPayload, name: 'AB' }, 'nome');
    expectError({ ...validPayload, address: 'Rua' }, 'endereço');
  });

  it.each([
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: 'abc', longitude: 0 },
    { latitude: undefined, longitude: undefined },
  ])('recusa coordenadas inválidas: %j', (coords) => {
    expectError({ ...validPayload, ...coords }, 'Localização inválida');
  });

  it.each([[], ['pneu'], undefined])('exige ao menos um tipo de resíduo válido: %j', (types) => {
    expectError({ ...validPayload, acceptedWasteTypes: types }, 'tipo de resíduo');
  });
});
