import { CollectionPoint, WasteType } from '../types/models';
import {
  createCollectionPointRecord,
  isCollectionPointSeedDone,
  listCollectionPoints,
  markCollectionPointSeedDone,
} from './storageService';

export const VALID_WASTE_TYPES: WasteType[] = [
  'smartphone',
  'computer',
  'tv_monitor',
  'appliance',
  'battery_accessory',
  'other',
];

type SamplePoint = Omit<CollectionPoint, 'id' | 'createdAt' | 'updatedAt'>;

// Pontos ILUSTRATIVOS em Londrina-PR para demonstração do mapa (RF04).
// Coordenadas aproximadas por região — os gestores devem substituí-los por pontos reais.
const SAMPLE_COLLECTION_POINTS: SamplePoint[] = [
  {
    name: 'Ecoponto Exemplo — Centro',
    address: 'Região central de Londrina (endereço ilustrativo)',
    city: 'Londrina - PR',
    latitude: -23.3103,
    longitude: -51.1628,
    acceptedWasteTypes: ['smartphone', 'computer', 'battery_accessory', 'appliance'],
    openingHours: 'Seg a Sex, 08h às 17h',
    phone: '',
    description: 'Ponto de demonstração. Recebe pequenos eletrônicos, celulares e pilhas.',
    managerId: 'system',
    managerName: 'EcoCiclo (exemplo)',
    isActive: true,
    isSample: true,
  },
  {
    name: 'Ecoponto Exemplo — Zona Norte',
    address: 'Zona Norte de Londrina (endereço ilustrativo)',
    city: 'Londrina - PR',
    latitude: -23.272,
    longitude: -51.164,
    acceptedWasteTypes: ['tv_monitor', 'computer', 'appliance', 'other'],
    openingHours: 'Seg a Sáb, 08h às 12h',
    phone: '',
    description: 'Ponto de demonstração. Aceita equipamentos maiores como TVs e monitores.',
    managerId: 'system',
    managerName: 'EcoCiclo (exemplo)',
    isActive: true,
    isSample: true,
  },
  {
    name: 'Coleta de Pilhas e Baterias — Exemplo Zona Sul',
    address: 'Zona Sul de Londrina (endereço ilustrativo)',
    city: 'Londrina - PR',
    latitude: -23.342,
    longitude: -51.158,
    acceptedWasteTypes: ['battery_accessory', 'smartphone'],
    openingHours: 'Todos os dias, 09h às 21h',
    phone: '',
    description: 'Ponto de demonstração. Coletor de pilhas, baterias e celulares.',
    managerId: 'system',
    managerName: 'EcoCiclo (exemplo)',
    isActive: true,
    isSample: true,
  },
  {
    name: 'Cooperativa de Reciclagem Exemplo — Zona Leste',
    address: 'Zona Leste de Londrina (endereço ilustrativo)',
    city: 'Londrina - PR',
    latitude: -23.305,
    longitude: -51.125,
    acceptedWasteTypes: [...VALID_WASTE_TYPES],
    openingHours: 'Seg a Sex, 07h30 às 17h30',
    phone: '',
    description: 'Ponto de demonstração. Cooperativa que recebe todos os tipos de REEE.',
    managerId: 'system',
    managerName: 'EcoCiclo (exemplo)',
    isActive: true,
    isSample: true,
  },
  {
    name: 'Ponto de Coleta Exemplo — Zona Oeste',
    address: 'Zona Oeste de Londrina (endereço ilustrativo)',
    city: 'Londrina - PR',
    latitude: -23.315,
    longitude: -51.2,
    acceptedWasteTypes: ['smartphone', 'computer', 'tv_monitor'],
    openingHours: 'Ter a Sáb, 10h às 18h',
    phone: '',
    description: 'Ponto de demonstração. Recebe celulares, computadores e monitores.',
    managerId: 'system',
    managerName: 'EcoCiclo (exemplo)',
    isActive: true,
    isSample: true,
  },
];

let seedInFlight: Promise<void> | null = null;

// Popula os pontos de exemplo uma única vez (na primeira consulta ao mapa)
export function ensureSampleCollectionPoints(): Promise<void> {
  if (!seedInFlight) {
    seedInFlight = (async () => {
      if (await isCollectionPointSeedDone()) return;
      const existing = await listCollectionPoints();
      if (existing.length === 0) {
        for (const sample of SAMPLE_COLLECTION_POINTS) {
          await createCollectionPointRecord(sample);
        }
      }
      await markCollectionPointSeedDone();
    })().catch((err) => {
      seedInFlight = null;
      throw err;
    });
  }
  return seedInFlight;
}

type PointFields = Pick<
  CollectionPoint,
  | 'name'
  | 'address'
  | 'city'
  | 'latitude'
  | 'longitude'
  | 'acceptedWasteTypes'
  | 'openingHours'
  | 'phone'
  | 'description'
  | 'isActive'
>;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Validação única usada no cadastro e na edição de pontos (RF12)
export function sanitizeCollectionPointPayload(
  raw: Record<string, unknown>
): { ok: true; data: PointFields } | { ok: false; error: string } {
  const name = str(raw.name);
  if (name.length < 3) {
    return { ok: false, error: 'Informe o nome do ponto de coleta (mínimo 3 caracteres).' };
  }

  const address = str(raw.address);
  if (address.length < 5) {
    return { ok: false, error: 'Informe o endereço completo do ponto de coleta.' };
  }

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      ok: false,
      error: 'Localização inválida. Clique no mapa ou use sua localização atual.',
    };
  }

  const acceptedWasteTypes = Array.isArray(raw.acceptedWasteTypes)
    ? Array.from(
        new Set(
          raw.acceptedWasteTypes.filter(
            (t: unknown): t is WasteType =>
              typeof t === 'string' && (VALID_WASTE_TYPES as string[]).includes(t)
          )
        )
      )
    : [];
  if (acceptedWasteTypes.length === 0) {
    return { ok: false, error: 'Selecione ao menos um tipo de resíduo eletrônico aceito.' };
  }

  return {
    ok: true,
    data: {
      name: name.slice(0, 100),
      address: address.slice(0, 200),
      city: (str(raw.city) || 'Londrina - PR').slice(0, 80),
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      acceptedWasteTypes,
      openingHours: (str(raw.openingHours) || 'Consultar horário no local').slice(0, 120),
      phone: str(raw.phone).slice(0, 30),
      description: str(raw.description).slice(0, 500),
      isActive: raw.isActive === undefined ? true : Boolean(raw.isActive),
    },
  };
}
