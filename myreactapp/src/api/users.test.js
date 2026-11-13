import { clearAccessToken, saveAccessToken } from './client';
import { createUser, getUserCreationOptions } from './resources';

const response = (payload) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
beforeEach(() => {
  saveAccessToken('test-user-token');
  global.fetch = jest.fn();
});
afterEach(clearAccessToken);

test('shows only accessible branch identifiers and omits unnecessary company data', async () => {
  fetch.mockResolvedValueOnce(response([{ id: 2, name: 'Vendedor', permissions: ['orders.manage'] }]))
    .mockResolvedValueOnce(response([{ id: 7, fantasy_name: 'Loja Centro', corporate_name: 'Empresa', filial_code: 'CENTRO', cnpj: 'private-data' }, { id: 99, fantasy_name: 'Outra loja' }]));
  await expect(getUserCreationOptions([7])).resolves.toEqual({ groups: [{ id: 2, name: 'Vendedor' }], filials: [{ id: 7, name: 'Loja Centro', code: 'CENTRO' }] });
});

test('whitelists UserCreate fields and discards secrets in the creation response', async () => {
  fetch.mockResolvedValue(response({ id: 50, full_name: 'Ana', username: 'ana', email: 'ana@example.com', password_hash: 'never-retain', password: 'never-retain' }));
  const payload = { full_name: 'Ana', username: 'ana', email: 'ana@example.com', password: 'secret-password', group_ids: [2], filial_ids: [7] };
  const result = await createUser({ ...payload, confirm_password: 'secret-password', is_superuser: true, is_active: false });
  const [url, options] = fetch.mock.calls[0];
  expect(url).toMatch(/\/users$/);
  expect(options.headers.Authorization).toBe('Bearer test-user-token');
  expect(JSON.parse(options.body)).toEqual(payload);
  expect(result).not.toHaveProperty('password');
  expect(result).not.toHaveProperty('password_hash');
});

test('rejects malformed options instead of permitting a user with unknown groups', async () => {
  fetch.mockResolvedValueOnce(response({ items: [] })).mockResolvedValueOnce(response([]));
  await expect(getUserCreationOptions([7])).rejects.toThrow(/perfis ou filiais inválidos/);
});
