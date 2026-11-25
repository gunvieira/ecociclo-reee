// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, getStoredToken, setStoredToken } from './api';

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
});

describe('armazenamento do token', () => {
  it('salva e remove o token', () => {
    setStoredToken('abc');
    expect(getStoredToken()).toBe('abc');

    setStoredToken(null);
    expect(getStoredToken()).toBeNull();
  });
});

describe('cliente HTTP', () => {
  it('envia o token de sessão no cabeçalho Authorization', async () => {
    setStoredToken('meu-token');
    const fetchMock = mockFetch(200, { items: [] });

    await api.listCollectionPoints();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer meu-token');
  });

  it('não envia Authorization quando não há sessão', async () => {
    const fetchMock = mockFetch(200, { items: [] });

    await api.listCollectionPoints();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  it('codifica o filtro de resíduo na URL', async () => {
    const fetchMock = mockFetch(200, { items: [] });

    await api.listCollectionPoints('tv_monitor');

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/collection-points\?wasteType=tv_monitor$/);
  });

  it('repassa a mensagem de erro enviada pelo servidor', async () => {
    mockFetch(401, { error: 'E-mail ou senha incorretos.' });

    await expect(api.login({ email: 'a@a.com', password: 'x' })).rejects.toThrow(
      'E-mail ou senha incorretos.'
    );
  });

  it('usa mensagem genérica quando o servidor não responde em JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));

    await expect(api.listInventory()).rejects.toThrow('Ocorreu um erro na comunicação com o servidor.');
  });

  it('trata resposta 204 (sem conteúdo) como sucesso', async () => {
    mockFetch(204);

    await expect(api.deleteProduct('p1')).resolves.toBeUndefined();
  });
});
