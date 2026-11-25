import { describe, expect, it } from 'vitest';
import { MAX_RECEIPT_BYTES, sanitizeProductPayload, validateReceiptInput } from './productService';

const validPayload = {
  name: 'Notebook',
  purchaseDate: '2024-03-10',
};

function expectError(raw: Record<string, unknown>, message: string) {
  const result = sanitizeProductPayload(raw);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain(message);
}

describe('sanitizeProductPayload', () => {
  it('aplica valores padrão aos campos opcionais', () => {
    const result = sanitizeProductPayload({ ...validPayload, category: 'computer' });

    expect(result).toEqual({
      ok: true,
      data: {
        name: 'Notebook',
        brand: 'Não informada',
        category: 'computer',
        purchaseDate: '2024-03-10',
        warrantyMonths: 12,
        estimatedLifespanMonths: 60, // padrão da categoria "computer"
        condition: 'in_use',
        notes: '',
      },
    });
  });

  it('usa a categoria "other" quando nenhuma é informada', () => {
    const result = sanitizeProductPayload(validPayload);

    expect(result.ok && result.data.category).toBe('other');
  });

  it('remove espaços e arredonda números', () => {
    const result = sanitizeProductPayload({
      ...validPayload,
      name: '  Notebook  ',
      brand: ' Lenovo ',
      warrantyMonths: 11.6,
      estimatedLifespanMonths: '24',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('Notebook');
      expect(result.data.brand).toBe('Lenovo');
      expect(result.data.warrantyMonths).toBe(12);
      expect(result.data.estimatedLifespanMonths).toBe(24);
    }
  });

  it('limita o tamanho dos textos', () => {
    const result = sanitizeProductPayload({
      ...validPayload,
      name: 'a'.repeat(500),
      notes: 'b'.repeat(5000),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toHaveLength(120);
      expect(result.data.notes).toHaveLength(1000);
    }
  });

  it.each([undefined, '', ' ', 'a'])('recusa nome inválido: %j', (name) => {
    expectError({ ...validPayload, name }, 'nome');
  });

  it.each([undefined, '2024-3-10', '10/03/2024', '2025-02-30', '2024-13-01', 20240310])(
    'recusa data de compra inválida ou inexistente: %j',
    (purchaseDate) => {
      expectError({ ...validPayload, purchaseDate }, 'data de compra');
    }
  );

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(sanitizeProductPayload({ ...validPayload, purchaseDate: '2024-02-29' }).ok).toBe(true);
  });

  it('recusa categoria e estado inexistentes', () => {
    expectError({ ...validPayload, category: 'geladeira' }, 'Categoria');
    expectError({ ...validPayload, condition: 'quebrado' }, 'Estado');
  });

  it.each([-1, 121, 'abc'])('recusa garantia fora do intervalo 0–120: %j', (warrantyMonths) => {
    expectError({ ...validPayload, warrantyMonths }, 'garantia');
  });

  it.each([5, 241])('recusa vida útil fora do intervalo 6–240: %j', (estimatedLifespanMonths) => {
    expectError({ ...validPayload, estimatedLifespanMonths }, 'vida útil');
  });

  it('aceita os limites exatos dos intervalos', () => {
    const result = sanitizeProductPayload({
      ...validPayload,
      warrantyMonths: 0,
      estimatedLifespanMonths: 240,
    });

    expect(result.ok && result.data.warrantyMonths).toBe(0);
    expect(result.ok && result.data.estimatedLifespanMonths).toBe(240);
  });
});

describe('validateReceiptInput', () => {
  const toDataUrl = (mimeType: string, bytes: number) =>
    `data:${mimeType};base64,${Buffer.alloc(bytes, 1).toString('base64')}`;

  const buildReceipt = (overrides: Record<string, unknown> = {}) => ({
    fileName: 'nota.png',
    mimeType: 'image/png',
    sizeBytes: 1,
    dataUrl: toDataUrl('image/png', 1234),
    ...overrides,
  });

  it('diferencia "não enviado" (undefined) de "remover anexo" (null)', () => {
    expect(validateReceiptInput(undefined)).toEqual({ valid: true, receipt: undefined });
    expect(validateReceiptInput(null)).toEqual({ valid: true, receipt: null });
  });

  it('calcula o tamanho pelo conteúdo, ignorando o valor informado pelo cliente', () => {
    const result = validateReceiptInput(buildReceipt({ sizeBytes: 999_999 }));

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.receipt?.sizeBytes).toBe(1234);
      expect(result.receipt?.uploadedAt).toEqual(expect.any(String));
    }
  });

  it('recusa arquivo maior que o limite, mesmo que o cliente declare um tamanho pequeno', () => {
    const result = validateReceiptInput(
      buildReceipt({ sizeBytes: 10, dataUrl: toDataUrl('image/png', MAX_RECEIPT_BYTES + 1) })
    );

    expect(result).toEqual({ valid: false, error: expect.stringContaining('5 MB') });
  });

  it('aceita PDF', () => {
    const result = validateReceiptInput(
      buildReceipt({ fileName: 'nota.pdf', mimeType: 'application/pdf', dataUrl: toDataUrl('application/pdf', 10) })
    );

    expect(result.valid).toBe(true);
  });

  it('recusa tipo de arquivo não permitido', () => {
    const result = validateReceiptInput(
      buildReceipt({ mimeType: 'text/html', dataUrl: toDataUrl('text/html', 10) })
    );

    expect(result).toEqual({ valid: false, error: expect.stringContaining('PNG, JPG, WEBP ou PDF') });
  });

  it('recusa conteúdo cujo tipo não corresponde ao declarado', () => {
    const result = validateReceiptInput(buildReceipt({ dataUrl: toDataUrl('image/jpeg', 10) }));

    expect(result.valid).toBe(false);
  });

  it('recusa arquivo vazio', () => {
    const result = validateReceiptInput(buildReceipt({ dataUrl: 'data:image/png;base64,' }));

    expect(result).toEqual({ valid: false, error: expect.stringContaining('vazio') });
  });

  it.each(['fileName', 'mimeType', 'dataUrl'])('recusa anexo sem o campo %s', (field) => {
    const receipt = buildReceipt();
    delete (receipt as Record<string, unknown>)[field];

    expect(validateReceiptInput(receipt).valid).toBe(false);
  });

  it('limita o nome do arquivo a 120 caracteres', () => {
    const result = validateReceiptInput(buildReceipt({ fileName: `${'a'.repeat(200)}.png` }));

    expect(result.valid && result.receipt?.fileName).toHaveLength(120);
  });
});
