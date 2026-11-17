import { clearAccessToken, saveAccessToken } from './client';
import { getPurchase, getPurchaseProductNames, listPurchases, listSuppliers, receivePurchase } from './purchases';

const response = (payload) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
beforeEach(() => {
  saveAccessToken('test-purchases-token');
  global.fetch = jest.fn(async () => response({ items: [], total: 0 }));
});
afterEach(clearAccessToken);

test('lists purchases with branch, pagination and only documented filters', async () => {
  await listPurchases(7, { offset: 50, status: 'pending', supplier_id: 30, start_date: '2026-11-01', end_date: '2026-11-17', filial_id: 999, receive: true });
  const [url, options] = fetch.mock.calls[0];
  expect(new URL(url, 'http://localhost').pathname).toBe('/api/v1/purchases');
  expect(Object.fromEntries(new URL(url, 'http://localhost').searchParams)).toEqual({ filial_id: '7', limit: '50', offset: '50', status: 'pending', supplier_id: '30', start_date: '2026-11-01', end_date: '2026-11-17' });
  expect(options.headers.Authorization).toBe('Bearer test-purchases-token');
  expect(options.method).toBeUndefined();
});

test('reads a purchase without calling receive, cancel or sync routes', async () => {
  fetch.mockResolvedValue(response({ id: 10, status: 'received' }));
  await expect(getPurchase(10)).resolves.toMatchObject({ id: 10, status: 'received' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toMatch(/\/purchases\/10$/);
  expect(fetch.mock.calls[0][1].method).toBeUndefined();
});

test('confirms receiving with an authenticated POST and no client stock or cost payload', async () => {
  const received = { id: 11, status: 'received', filial_id: 7 };
  fetch.mockResolvedValue(response(received));
  await expect(receivePurchase(11)).resolves.toEqual(received);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toMatch(/\/purchases\/11\/receive$/);
  expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer test-purchases-token');
  expect(options.body).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([null, { id: 11, status: 'pending' }, { id: 12, status: 'received' }])('requires the server to confirm the selected purchase was received (%j)', async (result) => {
  fetch.mockResolvedValue(response(result));
  await expect(receivePurchase(11)).rejects.toThrow(/servidor não confirmou o recebimento/);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('paginates suppliers and keeps only display names and ids', async () => {
  fetch.mockResolvedValueOnce(response({ items: [{ id: 30, display_name: 'Fornecedor A', cnpj: 'private' }], total: 2 }))
    .mockResolvedValueOnce(response({ items: [{ id: 31, display_name: 'Fornecedor B' }], total: 2 }));
  await expect(listSuppliers(7)).resolves.toEqual([{ id: 30, name: 'Fornecedor A' }, { id: 31, name: 'Fornecedor B' }]);
  expect(fetch.mock.calls[0][0]).toContain('role=supplier');
  expect(fetch.mock.calls[0][0]).toContain('filial_id=7');
  expect(fetch.mock.calls[1][0]).toContain('offset=1');
});

test('rejects malformed pages instead of showing fake totals', async () => {
  fetch.mockResolvedValue(response({ items: [], total: '10' }));
  await expect(listPurchases(7)).rejects.toThrow(/listagem de compras inválida/);
});

test('fetches one product name per unique item id', async () => {
  fetch.mockImplementation(async (url) => response({ name: url.endsWith('/20') ? 'Produto A' : 'Produto B' }));
  await expect(getPurchaseProductNames([20, 20, 21])).resolves.toEqual({ 20: 'Produto A', 21: 'Produto B' });
  expect(fetch).toHaveBeenCalledTimes(2);
});
