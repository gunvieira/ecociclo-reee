import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

const app = createApp();

let emailCounter = 0;
const uniqueEmail = () => `usuario${++emailCounter}@teste.com`;

async function registerUser(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Usuário Teste',
      email: uniqueEmail(),
      password: '123456',
      lgpdConsent: true,
      ...overrides,
    });
  expect(res.status).toBe(201);
  return { user: res.body.user, auth: `Bearer ${res.body.token}` };
}

const newProduct = { name: 'Celular', category: 'smartphone', purchaseDate: '2024-01-10' };

const newPoint = {
  name: 'Ecoponto Teste',
  address: 'Rua de Teste, 123',
  latitude: -23.31,
  longitude: -51.16,
  acceptedWasteTypes: ['smartphone'],
};

describe('GET /api/health', () => {
  it('responde ok em modo local', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', storageMode: 'local' });
  });
});

describe('Autenticação', () => {
  it('cadastra usuário sem expor o hash da senha', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: uniqueEmail(), password: '123456', lgpdConsent: true });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Ana', role: 'consumer' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('exige o consentimento LGPD no cadastro', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: uniqueEmail(), password: '123456', lgpdConsent: false });

    expect(res.status).toBe(400);
  });

  it.each([
    [{ name: 'A' }, 'nome curto'],
    [{ email: 'email-invalido' }, 'e-mail inválido'],
    [{ password: '123' }, 'senha curta'],
  ])('recusa cadastro com %j (%s)', async (override, _motivo) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: uniqueEmail(), password: '123456', lgpdConsent: true, ...override });

    expect(res.status).toBe(400);
  });

  it('impede e-mail duplicado, sem diferenciar maiúsculas', async () => {
    const email = uniqueEmail();
    await registerUser({ email });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Outro', email: email.toUpperCase(), password: '123456', lgpdConsent: true });

    expect(res.status).toBe(409);
  });

  it('só concede o perfil de gestor quando solicitado explicitamente', async () => {
    const { user: manager } = await registerUser({ role: 'manager' });
    const { user: other } = await registerUser({ role: 'admin' });

    expect(manager.role).toBe('manager');
    expect(other.role).toBe('consumer');
  });

  it('faz login com e-mail em qualquer caixa e recusa senha errada', async () => {
    const email = uniqueEmail();
    await registerUser({ email, password: 'senha-certa' });

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: email.toUpperCase(), password: 'senha-certa' });
    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'senha-errada' });

    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));
    expect(wrong.status).toBe(401);
  });

  it('GET /me retorna o usuário da sessão', async () => {
    const { user, auth } = await registerUser();

    const res = await request(app).get('/api/auth/me').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it.each([undefined, 'Bearer token-invalido', 'Basic abc'])(
    'bloqueia rotas protegidas com cabeçalho %j',
    async (header) => {
      const req = request(app).get('/api/products');
      if (header) req.set('Authorization', header);

      expect((await req).status).toBe(401);
    }
  );
});

describe('Inventário de produtos', () => {
  it('cadastra, lista, edita e exclui um produto', async () => {
    const { auth } = await registerUser();

    const created = await request(app).post('/api/products').set('Authorization', auth).send(newProduct);
    expect(created.status).toBe(201);
    expect(created.body.product.lifecycle).toBeDefined();
    const id = created.body.product.id;

    const list = await request(app).get('/api/products').set('Authorization', auth);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.summary.totalProducts).toBe(1);

    const updated = await request(app)
      .put(`/api/products/${id}`)
      .set('Authorization', auth)
      .send({ condition: 'idle' });
    expect(updated.status).toBe(200);
    expect(updated.body.product).toMatchObject({ name: 'Celular', condition: 'idle' });

    const removed = await request(app).delete(`/api/products/${id}`).set('Authorization', auth);
    expect(removed.status).toBe(204);

    const after = await request(app).get('/api/products').set('Authorization', auth);
    expect(after.body.items).toHaveLength(0);
  });

  it('recusa produto inválido', async () => {
    const { auth } = await registerUser();

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', auth)
      .send({ ...newProduct, purchaseDate: '2025-02-30' });

    expect(res.status).toBe(400);
  });

  it('isola o inventário: um usuário não vê, edita nem exclui produtos de outro', async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', owner.auth)
      .send(newProduct);
    const id = created.body.product.id;

    const list = await request(app).get('/api/products').set('Authorization', intruder.auth);
    const edit = await request(app)
      .put(`/api/products/${id}`)
      .set('Authorization', intruder.auth)
      .send({ name: 'Invadido' });
    const remove = await request(app).delete(`/api/products/${id}`).set('Authorization', intruder.auth);

    expect(list.body.items).toHaveLength(0);
    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);

    const ownerList = await request(app).get('/api/products').set('Authorization', owner.auth);
    expect(ownerList.body.items[0].name).toBe('Celular');
  });

  it('gera os 3 produtos de demonstração', async () => {
    const { auth } = await registerUser();

    const res = await request(app).post('/api/products/seed-demo').set('Authorization', auth);

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.alerts.length).toBeGreaterThan(0);
  });
});

describe('Pontos de coleta', () => {
  it('lista os pontos de exemplo e filtra por tipo de resíduo', async () => {
    const { auth } = await registerUser();

    const all = await request(app).get('/api/collection-points').set('Authorization', auth);
    const tvs = await request(app)
      .get('/api/collection-points?wasteType=tv_monitor')
      .set('Authorization', auth);

    expect(all.status).toBe(200);
    expect(all.body.items.length).toBeGreaterThan(0);
    expect(tvs.body.items.length).toBeLessThan(all.body.items.length);
    expect(
      tvs.body.items.every((p: { acceptedWasteTypes: string[] }) =>
        p.acceptedWasteTypes.includes('tv_monitor')
      )
    ).toBe(true);
  });

  it('consumidor não pode usar as rotas de gestor', async () => {
    const { auth } = await registerUser();

    const create = await request(app).post('/api/collection-points').set('Authorization', auth).send(newPoint);
    const mine = await request(app).get('/api/collection-points/mine').set('Authorization', auth);

    expect(create.status).toBe(403);
    expect(mine.status).toBe(403);
  });

  it('ponto desativado pelo gestor deixa de aparecer para o consumidor', async () => {
    const manager = await registerUser({ role: 'manager' });
    const consumer = await registerUser();

    const created = await request(app)
      .post('/api/collection-points')
      .set('Authorization', manager.auth)
      .send(newPoint);
    expect(created.status).toBe(201);
    const id = created.body.point.id;

    const isVisible = async () => {
      const res = await request(app).get('/api/collection-points').set('Authorization', consumer.auth);
      return res.body.items.some((p: { id: string }) => p.id === id);
    };

    expect(await isVisible()).toBe(true);

    const toggle = await request(app)
      .put(`/api/collection-points/${id}`)
      .set('Authorization', manager.auth)
      .send({ isActive: false });
    expect(toggle.status).toBe(200);
    expect(toggle.body.point.name).toBe(newPoint.name);

    expect(await isVisible()).toBe(false);
  });

  it('gestor não pode editar nem excluir o ponto de outro gestor', async () => {
    const owner = await registerUser({ role: 'manager' });
    const other = await registerUser({ role: 'manager' });
    const created = await request(app)
      .post('/api/collection-points')
      .set('Authorization', owner.auth)
      .send(newPoint);
    const id = created.body.point.id;

    const edit = await request(app)
      .put(`/api/collection-points/${id}`)
      .set('Authorization', other.auth)
      .send({ name: 'Invadido' });
    const remove = await request(app).delete(`/api/collection-points/${id}`).set('Authorization', other.auth);

    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);
  });
});
