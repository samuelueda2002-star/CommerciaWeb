import { analyticsApi, exportAnalytics, forecastsApi, optionalForecast } from './analytics';
import { getCurrentUser } from './auth';
import { ApiError, clearAccessToken, saveAccessToken } from './client';
import { getAllReports } from './dashboard';
import { createOrder, listUsers } from './resources';

const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });
beforeEach(() => {
  saveAccessToken('analytics-test-token');
  global.fetch = jest.fn(async () => response({}));
});
afterEach(clearAccessToken);

test('sends branch and scope, omits automatic model, and never sends unrelated analytics parameters', async () => {
  await analyticsApi.salesDaily(7, { level: 'category', entity_id: 30, start_date: '2026-10-01', end_date: '2026-10-28', model: 'exp_smoothing', irrelevant: true });
  const url = new URL(fetch.mock.calls[0][0], 'http://localhost');
  expect(Object.fromEntries(url.searchParams)).toEqual({ filial_id: '7', level: 'category', entity_id: '30', start_date: '2026-10-01', end_date: '2026-10-28' });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer analytics-test-token');
});

test('requires entity_id for the original simple forecast route even at filial level', async () => {
  await forecastsApi.points(7, { level: 'filial', entity_id: 7, target: 'revenue', model: '' });
  expect(fetch.mock.calls[0][0]).toContain('entity_id=7');
  expect(fetch.mock.calls[0][0]).not.toContain('model=');
  await forecastsApi.compare(7, { level: 'filial', entity_id: 7, target: 'revenue', history_days: 28 });
  expect(fetch.mock.calls[1][0]).not.toContain('entity_id');
});

test('keeps stockouts branch-wide and sends product_id only to the stock history route', async () => {
  await analyticsApi.stockouts(7, { level: 'category', entity_id: 30, limit: 20, start_date: '2026-10-01' });
  expect(fetch.mock.calls[0][0]).not.toContain('entity_id');
  expect(fetch.mock.calls[0][0]).not.toContain('level=');
  await analyticsApi.stockDaily(7, { product_id: 20, start_date: '2026-10-01', end_date: '2026-10-28' });
  expect(fetch.mock.calls[1][0]).toContain('product_id=20');
});

test('treats a missing forecast as unavailable but propagates forbidden-plan errors', async () => {
  await expect(optionalForecast(() => Promise.reject(new ApiError('Ainda não gerada', 404)))).resolves.toEqual({ data: null, unavailable: true, message: 'Ainda não gerada' });
  await expect(optionalForecast(() => Promise.reject(new ApiError('Plano Hulk necessário', 403)))).rejects.toMatchObject({ status: 403 });
});

test('exports all twelve new read endpoints when a product is selected, preserving their parameter contracts', async () => {
  await exportAnalytics(7, { level: 'product', entity_id: 20, start_date: '2026-10-01', end_date: '2026-10-28', ranking_level: 'category', metric: 'margin' }, { level: 'product', entity_id: 20, target: 'quantity', model: '' }, 20);
  expect(fetch).toHaveBeenCalledTimes(12);
  const rankingUrl = fetch.mock.calls.find(([url]) => url.includes('/sales/ranking'))[0];
  expect(rankingUrl).toContain('level=category');
  expect(rankingUrl).toContain('metric=margin');
  expect(rankingUrl).not.toContain('entity_id');
});

test('keeps an explicit unavailable forecast in the exported metadata', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.includes('/forecasts') ? Promise.resolve(response({ detail: 'Ainda não gerada' }, 404)) : baseFetch(url, options));
  const result = await exportAnalytics(7, {}, { level: 'filial', target: 'quantity' }, null);
  expect(result.forecasts.compare).toMatchObject({ unavailable: true, data: null });
  expect(fetch.mock.calls.find(([url]) => new URL(url, 'http://localhost').pathname.endsWith('/forecasts'))[0]).toContain('entity_id=7');
});

test('online order transport whitelists fields and excludes offline metadata and client prices', async () => {
  await createOrder(7, { client_id: 10, payment_method: 'pix', discount: '1.00', occurred_at: '2026-11-07T10:00:00-03:00', client_reference: 'offline-1', items: [{ product_id: 20, quantity: 2, unit_price: '30.00', total: '60.00' }] });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ client_id: 10, payment_method: 'pix', discount: '1.00', items: [{ product_id: 20, quantity: 2 }] });
});

test('collects all pages of legacy reports before exporting', async () => {
  global.fetch = jest.fn(async (url) => {
    if (url.includes('/sales-by-category?')) {
      const offset = new URL(url, 'http://localhost').searchParams.get('offset');
      return response({ items: [{ category_id: offset ? 2 : 1 }], total: 2 });
    }
    return response({ items: [], total: 0 });
  });
  const reports = await getAllReports(7, { start_date: '2026-10-01', end_date: '2026-10-28' });
  expect(reports.salesByCategory).toEqual({ items: [{ category_id: 1 }, { category_id: 2 }], total: 2 });
  expect(fetch.mock.calls.some(([url]) => url.includes('/sales-by-category?') && url.includes('offset=1'))).toBe(true);
  expect(fetch.mock.calls.find(([url]) => url.includes('/low-stock?'))[0]).not.toContain('start_date');
});

test('discards password hashes from auth and users responses', async () => {
  const user = { id: 1, username: 'admin', full_name: 'Equipe', email: 'a@example.com', password_hash: 'should-never-be-kept', accessible_filial_ids: [7] };
  fetch.mockResolvedValueOnce(response(user)).mockResolvedValueOnce(response({ items: [user], total: 1 }));
  const current = await getCurrentUser('analytics-test-token');
  const users = await listUsers();
  expect(current).not.toHaveProperty('password_hash');
  expect(users[0]).not.toHaveProperty('password_hash');
});
