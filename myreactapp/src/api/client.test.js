import { ApiError, clearAccessToken, getAccessToken, request, saveAccessToken } from './client';
import { getAllReports, reportsApi } from './dashboard';
import { listAll } from './resources';

const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });

beforeEach(() => {
  clearAccessToken();
  global.fetch = jest.fn(async () => response({}));
});

afterEach(() => {
  clearAccessToken();
  jest.useRealTimers();
});

test('encodes queries and keeps zero values without leaking the token into the URL', async () => {
  saveAccessToken('private-token');
  await request('/example', { query: { filial_id: 7, offset: 0, q: 'a & b', missing: undefined } });
  const [url, options] = fetch.mock.calls[0];
  expect(url).toContain('offset=0');
  expect(url).toContain('q=a+%26+b');
  expect(url).not.toContain('private-token');
  expect(url).not.toContain('missing');
  expect(options.headers.Authorization).toBe('Bearer private-token');
});

test('handles 403 without clearing a valid session', async () => {
  saveAccessToken('valid-token');
  fetch.mockResolvedValue(response({ detail: 'Forbidden' }, 403));
  await expect(request('/example')).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/permissão/i) });
  expect(getAccessToken()).toBe('valid-token');
});

test('converts validation failures and network failures into readable errors', async () => {
  fetch.mockResolvedValueOnce(response({ detail: [{ msg: 'Data inválida' }] }, 422));
  await expect(request('/example')).rejects.toMatchObject({ status: 422, message: 'Data inválida' });
  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(request('/example')).rejects.toThrow(/conectar à API/i);
});

test('rejects an HTML response instead of treating it as API data', async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '<html>SPA</html>' });
  await expect(request('/example')).rejects.toBeInstanceOf(ApiError);
});

test('aborts a slow request after the timeout', async () => {
  jest.useFakeTimers();
  fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const pending = request('/example');
  const assertion = expect(pending).rejects.toThrow(/demorou para responder/i);
  jest.advanceTimersByTime(15000);
  await assertion;
});

test('never sends filial_id to the cross-branch report', async () => {
  await reportsApi.salesByFilial(7, { filial_id: 99, start_date: '2026-10-01', end_date: '2026-10-07' });
  expect(fetch.mock.calls[0][0]).not.toContain('filial_id');
  expect(fetch.mock.calls[0][0]).toContain('start_date=2026-10-01');
});

test('exports all sixteen documented reports with the required comparison dates', async () => {
  await getAllReports(7, { start_date: '2026-10-01', end_date: '2026-10-07' });
  expect(fetch).toHaveBeenCalledTimes(16);
  const comparisonUrl = fetch.mock.calls.find(([url]) => url.includes('/sales-comparison'))[0];
  expect(comparisonUrl).toContain('start_date=2026-10-01');
  expect(comparisonUrl).toContain('end_date=2026-10-07');
  expect(fetch.mock.calls.find(([url]) => url.includes('/top-products'))[0]).toContain('sort_by=revenue');
});

test('follows pagination until the list is complete', async () => {
  fetch.mockResolvedValueOnce(response({ items: [{ id: 1 }], total: 2 })).mockResolvedValueOnce(response({ items: [{ id: 2 }], total: 2 }));
  await expect(listAll('/clients', 7)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  expect(fetch.mock.calls[1][0]).toContain('offset=1');
});

test('detects an incomplete page rather than looping or showing misleading totals', async () => {
  fetch.mockResolvedValue(response({ items: [], total: 1 }));
  await expect(listAll('/clients', 7)).rejects.toThrow(/listagem completa/i);
});
