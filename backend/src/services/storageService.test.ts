import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicUser } from '../types/models';
import { hashPassword, issueLocalToken, verifyLocalToken, verifyPassword } from './storageService';

const user: PublicUser = {
  id: 'user-1',
  name: 'Maria',
  email: 'maria@exemplo.com',
  role: 'consumer',
  lgpdConsentAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('hashPassword / verifyPassword', () => {
  it('valida a senha correta e recusa a incorreta', () => {
    const hash = hashPassword('senha-secreta');

    expect(verifyPassword('senha-secreta', hash)).toBe(true);
    expect(verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('usa salt aleatório: a mesma senha gera hashes diferentes', () => {
    expect(hashPassword('123456')).not.toBe(hashPassword('123456'));
  });

  it('nunca armazena a senha em texto puro', () => {
    expect(hashPassword('senha-secreta')).not.toContain('senha-secreta');
  });

  it.each([undefined, '', 'sem-separador', 'salt:'])('recusa hash ausente ou malformado: %j', (stored) => {
    expect(verifyPassword('qualquer', stored)).toBe(false);
  });
});

describe('issueLocalToken / verifyLocalToken', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('o token emitido é aceito e identifica o usuário', () => {
    const payload = verifyLocalToken(issueLocalToken(user));

    expect(payload).toMatchObject({ sub: 'user-1', email: 'maria@exemplo.com', role: 'consumer' });
  });

  it('recusa token com conteúdo adulterado (ex.: troca de perfil para gestor)', () => {
    const [, signature] = issueLocalToken(user).split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'user-1', email: user.email, role: 'manager', exp: Date.now() + 60_000 })
    ).toString('base64url');

    expect(verifyLocalToken(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it('recusa token com assinatura adulterada', () => {
    const [payload] = issueLocalToken(user).split('.');

    expect(verifyLocalToken(`${payload}.assinatura-falsa`)).toBeNull();
  });

  it.each(['', 'abc', 'a.b.c'])('recusa token em formato inválido: %j', (token) => {
    expect(verifyLocalToken(token)).toBeNull();
  });

  it('expira após 7 dias', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const token = issueLocalToken(user);

    vi.setSystemTime(new Date('2024-01-07T23:59:00Z'));
    expect(verifyLocalToken(token)).not.toBeNull();

    vi.setSystemTime(new Date('2024-01-08T00:01:00Z'));
    expect(verifyLocalToken(token)).toBeNull();
  });
});
