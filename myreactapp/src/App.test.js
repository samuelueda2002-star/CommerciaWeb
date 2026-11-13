import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { clearAccessToken, getAccessToken, saveAccessToken } from './api/client';

const user = { id: 1, username: 'admin', email: 'admin@example.com', is_superuser: true, accessible_filial_ids: [7, 8] };
const client = { id: 10, first_name: 'Mariana', last_name: 'Costa', email: 'mariana@example.com', cpf: '12345678909', phone: null, birth_date: null, status: 'active' };
const products = [
  { id: 20, name: 'Camiseta API', sku: 'SKU-20', category_id: 30, status: 'active' },
  { id: 21, name: 'Tênis API', sku: 'SKU-21', category_id: 31, status: 'inactive' },
];
const categories = [{ id: 30, name: 'Vestuário', department_id: 5 }, { id: 31, name: 'Calçados', department_id: 5 }];
const departments = [{ id: 5, name: 'Moda' }, { id: 6, name: 'Casa' }];
const orders = [
  { id: 40, client_id: 10, total: '20.50', status: 'paid', created_at: new Date().toISOString() },
  { id: 41, client_id: 10, total: '10.00', status: 'pending', created_at: new Date().toISOString() },
  { id: 42, client_id: 10, total: '100.00', status: 'cancelled', created_at: new Date().toISOString() },
];

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) };
}

function page(items) {
  return { items, total: items.length, limit: 200, offset: 0 };
}

function mockApi() {
  global.fetch = jest.fn(async (url) => {
    const parsedUrl = new URL(url, 'http://localhost');
    const path = parsedUrl.pathname.replace('/api/v1', '');
    const start = parsedUrl.searchParams.get('start_date') || '2026-10-03';
    const end = parsedUrl.searchParams.get('end_date') || '2026-10-30';
    if (path === '/auth/login') return response({ access_token: 'test-token' });
    if (path === '/auth/me') return response(user);
    if (path === '/dashboard/indicators') return response({ sales_today: '123.45', new_clients_today: 2, active_products: 3, stock_value: '80', last_7_days: [{ date: '2026-10-15', count: 1, total: '123.45' }] });
    if (path === '/catalog/products') return response(page(products));
    if (path === '/catalog/categories') return response(page(categories));
    if (path === '/catalog/departments') return response(departments);
    if (path === '/clients') return response(page([client]));
    if (path === '/orders') return response(page(orders));
    if (path.endsWith('/prices/current')) return response({ price_default: '25.90', price_offer: null });
    if (path.endsWith('/stock')) return response({ quantity: 4 });
    if (path.endsWith('/sales-summary')) return response({ total_revenue: '30.50', average_ticket: '15.25', total_orders: 2, cancelled_orders: 1, cancellation_rate: '33.33' });
    if (path.endsWith('/sales-by-client')) return response(page([{ client_id: 10, total_orders: 2 }]));
    if (path.endsWith('/sales-by-status')) return response(page([{ status: 'pending', count: 1 }, { status: 'paid', count: 1 }, { status: 'cancelled', count: 1 }]));
    if (path.endsWith('/sales-comparison')) return response({ revenue_change_pct: -10, orders_change_pct: null });
    if (path.endsWith('/sales-by-category')) return response(page([{ quantity_sold: 5, total_revenue: '30.50' }]));
    if (path.endsWith('/sales-by-weekday')) return response([{ weekday: 0, total: '30.50' }]);
    if (path === '/analytics/status') return response({ first_day: '2025-10-31', last_day: '2026-11-10', last_sale_date: '2026-10-30', last_job: { status: 'success' } });
    if (path === '/analytics/sales/compare') return response({ entity: { name: 'Filial API' }, current: { start_date: start, end_date: end, revenue: '30.50', cost: '10.00', margin: '20.50', quantity: 5 }, previous: { start_date: '2026-09-05', end_date: '2026-10-02' }, change_pct: { revenue: '0.0963', quantity: null, cost: '0', margin: '-0.1' } });
    if (path === '/analytics/sales/daily') return response({ entity: { name: 'Filial API' }, start_date: start, end_date: end, points: [{ date: start, revenue: '10.50', quantity: 2, cost: '3', margin: '7.50' }, { date: end, revenue: '20.00', quantity: 3, cost: '7', margin: '13' }] });
    if (path === '/analytics/sales/ranking') return response({ items: [{ id: 20, name: 'Líder de vendas', quantity: 5, revenue: '30.50', cost: '10', margin: '20.50', margin_pct: '0.6721', share_pct: '0.1109' }] });
    if (path === '/analytics/stockouts') return response({ items: [{ product_id: 20, product_name: 'Produto em ruptura', category_name: 'Vestuário', days_out: 2, last_out_date: '2026-10-20', current_qty: 4 }] });
    if (path === '/analytics/stock/daily') return response({ entity: { name: 'Produto em ruptura' }, points: [{ date: start, end_of_day_qty: 0, min_qty: 0, was_out_of_stock: true }, { date: end, end_of_day_qty: 4, min_qty: 2, was_out_of_stock: false }] });
    if (path === '/forecasts/summary') return response({ entity: { name: 'Filial API' }, data_until: '2026-10-30', targets: {
      quantity: { model: 'exp_smoothing', next_7_days: '100', next_14_days: '200', change_7_days_pct: '-0.0289', change_14_days_pct: '0', expected_wape_days_1_7: '0.1462', expected_wape_days_8_14: null },
      revenue: { model: 'moving_average', next_7_days: '90.10', next_14_days: '180.20', change_7_days_pct: null, change_14_days_pct: '0.0092', expected_wape_days_1_7: '0.1626', expected_wape_days_8_14: '0.16' },
    } });
    if (path === '/forecasts/compare') return response({ entity: { name: 'Filial API' }, run: { model: 'exp_smoothing', train_end: '2026-10-30', horizon_days: 14 }, history: [{ date: '2026-10-30', actual: '4' }], forecast: [{ date: '2026-10-31', predicted: '5', lower: '2', upper: '8' }] });
    if (path === '/forecasts/backtest') return response({ entity: { name: 'Filial API' }, origins: [{ run_id: 1, model: 'exp_smoothing', train_end: '2026-10-15', wape: '0.11', points: [{ date: '2026-10-16', predicted: '5', actual: '4', out_of_stock: true }] }] });
    if (path === '/forecasts/accuracy') return response([{ model: 'exp_smoothing', horizon_bucket: '1-7', wape: '0.1462', mape: null, mae: '2.3', bias: '-0.04', n_runs: 12 }]);
    if (path === '/forecasts/runs') return response([{ id: 1, model: 'exp_smoothing', model_version: '1.0', train_end: '2026-10-30', created_at: '2026-10-31T07:00:00Z', horizon_days: 14 }]);
    if (path === '/forecasts') return response({ points: [] });
    if (path === '/users/groups') return response([{ id: 1, name: 'Administrador' }, { id: 2, name: 'Vendedor' }]);
    if (path === '/companies') return response([{ id: 7, fantasy_name: 'Loja Centro', filial_code: 'CENTRO' }, { id: 8, fantasy_name: 'Loja Norte', filial_code: 'NORTE' }]);
    if (path === '/users') return response(page([{ ...user, full_name: 'Equipe API', is_active: true, last_login: null, groups: [] }]));
    if (path.startsWith('/dashboard/reports/')) return response(page([]));
    return response([]);
  });
}

async function signIn(remember = false) {
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'secret' } });
  if (remember) fireEvent.click(screen.getByLabelText(/manter-me conectado/i));
  fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form'));
  await screen.findByRole('heading', { name: /^dashboard$/i });
}

beforeEach(() => {
  clearAccessToken();
  mockApi();
});

afterEach(() => {
  clearAccessToken();
  jest.restoreAllMocks();
});

test('authenticates the existing login form and loads indicators for the first accessible branch', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /bem-vindo de volta/i })).toBeInTheDocument();
  await signIn();
  const [url, options] = fetch.mock.calls.find(([value]) => value.endsWith('/auth/login'));
  expect(url).toMatch(/\/api\/v1\/auth\/login$/);
  expect(options.method).toBe('POST');
  expect(options.body.get('username')).toBe('admin');
  expect(options.body.get('password')).toBe('secret');
  expect(options.headers.Authorization).toBeUndefined();
  expect(window.sessionStorage.getItem('commercia.access_token')).toBe('test-token');
  expect(window.localStorage.getItem('commercia.access_token')).toBeNull();
  expect(await screen.findByText(/123,45/)).toBeInTheDocument();
  const indicatorsCall = fetch.mock.calls.find(([value]) => value.includes('/dashboard/indicators'));
  expect(indicatorsCall[0]).toContain('filial_id=7');
  expect(indicatorsCall[1].headers.Authorization).toBe('Bearer test-token');
});

test('rejects invalid credentials without opening the dashboard', async () => {
  fetch.mockResolvedValue(response({ detail: 'Invalid credentials' }, 401));
  render(<App />);
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'wrong' } });
  fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/credenciais inválidas/i);
  expect(screen.queryByRole('heading', { name: /^dashboard$/i })).not.toBeInTheDocument();
  expect(getAccessToken()).toBeNull();
});

test('remembers the session only when selected, restores it, and clears it on logout', async () => {
  const first = render(<App />);
  await signIn(true);
  expect(window.localStorage.getItem('commercia.access_token')).toBe('test-token');
  first.unmount();
  fetch.mockClear();
  render(<App />);
  await screen.findByRole('heading', { name: /^dashboard$/i });
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/auth/login'))).toBe(false);
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/auth/me'))).toBe(true);
  fireEvent.click(screen.getByTitle('Sair da conta'));
  expect(screen.getByRole('heading', { name: /bem-vindo de volta/i })).toBeInTheDocument();
  expect(getAccessToken()).toBeNull();
});

test('does not open a session without an accessible branch', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.endsWith('/auth/me') ? Promise.resolve(response({ ...user, accessible_filial_ids: [] })) : baseFetch(url, options));
  render(<App />);
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'secret' } });
  fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/não possui uma filial acessível/i);
  expect(getAccessToken()).toBeNull();
});

test('returns to login when an authenticated request receives 401', async () => {
  saveAccessToken('expired-token');
  fetch.mockResolvedValue(response({ detail: 'Unauthorized' }, 401));
  render(<App />);
  await waitFor(() => expect(getAccessToken()).toBeNull());
  expect(await screen.findByRole('alert')).toHaveTextContent(/expir/i);
  expect(screen.queryByRole('heading', { name: /^dashboard$/i })).not.toBeInTheDocument();
});

test('shows unavailable dashboard routes without fake metrics and permits retry', async () => {
  const baseFetch = fetch;
  let available = false;
  global.fetch = jest.fn((url, options) => url.includes('/dashboard/indicators') && !available ? Promise.resolve(response({ detail: 'Not Found' }, 404)) : baseFetch(url, options));
  render(<App />);
  await signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent(/ainda não estão disponíveis/i);
  expect(screen.queryByText('R$ 4.280')).not.toBeInTheDocument();
  available = true;
  fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
  expect(await screen.findByText(/123,45/)).toBeInTheDocument();
});

test('loads real product prices and stock, then applies category and text filters', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  expect(await screen.findByText('Camiseta API')).toBeInTheDocument();
  expect(screen.getAllByText(/25,90/)).toHaveLength(2);
  expect(screen.getByText('Baixo estoque')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '30' } });
  expect(screen.queryByText('Tênis API')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: 'inexistente' } });
  expect(screen.getByText('Nenhum registro encontrado.')).toBeInTheDocument();
});

test('creates a product from the selected category and reloads the catalog without stale filters', async () => {
  const baseFetch = fetch;
  let createdProduct;
  global.fetch = jest.fn((url, options) => {
    if (url.includes('/catalog/products?')) {
      if (options.method === 'POST') {
        createdProduct = { ...JSON.parse(options.body), id: 22, status: 'active', filial_id: 7 };
        return Promise.resolve(response(createdProduct, 201));
      }
      return Promise.resolve(response(page(createdProduct ? [...products, createdProduct] : products)));
    }
    if (/\/products\/22\/(prices\/current|stock)$/.test(url)) return Promise.resolve(response({ detail: 'Not Found' }, 404));
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  await screen.findByText('Camiseta API');
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: 'camiseta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Novo produto' }));
  const dialog = screen.getByRole('dialog', { name: 'Novo produto' });
  await within(dialog).findByRole('option', { name: 'Vestuário' });
  expect(within(dialog).getByLabelText(/^Categoria/)).toHaveValue('30');
  fireEvent.change(within(dialog).getByLabelText(/^Nome/), { target: { value: 'Sandália nova' } });
  fireEvent.change(within(dialog).getByLabelText(/^SKU/), { target: { value: 'SAND-22' } });
  fireEvent.change(within(dialog).getByLabelText(/^Categoria/), { target: { value: '31' } });
  fireEvent.submit(within(dialog).getByRole('button', { name: 'Salvar produto' }).closest('form'));
  const row = (await screen.findByText('Sandália nova')).closest('tr');
  expect(within(row).getByText('Calçados')).toBeInTheDocument();
  expect(within(row).getAllByText('—')).toHaveLength(2);
  expect(screen.getByText('Produto cadastrado com sucesso.')).toBeInTheDocument();
  expect(screen.getByLabelText('Pesquisar')).toHaveValue('');
  expect(screen.getByLabelText('Categoria')).toHaveValue('');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST' && options.headers['Content-Type'] === 'application/json')).toHaveLength(1);
});

test('cancels product edits without changes and then updates the selected product', async () => {
  const baseFetch = fetch;
  let savedProduct = { ...products[0] };
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith('/catalog/products/20') && options.method === 'PATCH') {
      savedProduct = { ...savedProduct, ...JSON.parse(options.body) };
      return Promise.resolve(response(savedProduct));
    }
    if (url.includes('/catalog/products?')) return Promise.resolve(response(page([savedProduct, products[1]])));
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Camiseta API' }));
  await within(screen.getByRole('dialog', { name: 'Editar produto' })).findByRole('option', { name: 'Vestuário' });
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Rascunho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByText('Camiseta API')).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Camiseta API' }));
  const dialog = screen.getByRole('dialog', { name: 'Editar produto' });
  await within(dialog).findByRole('option', { name: 'Vestuário' });
  expect(within(dialog).getByLabelText(/^Nome/)).toHaveValue('Camiseta API');
  fireEvent.change(within(dialog).getByLabelText(/^Nome/), { target: { value: 'Produto atualizado' } });
  fireEvent.change(within(dialog).getByLabelText(/^Categoria/), { target: { value: '31' } });
  fireEvent.submit(within(dialog).getByRole('button', { name: 'Salvar alterações' }).closest('form'));
  const row = (await screen.findByText('Produto atualizado')).closest('tr');
  expect(within(row).getByText('Calçados')).toBeInTheDocument();
  expect(screen.getByText('Tênis API')).toBeInTheDocument();
  expect(screen.queryByText('Camiseta API')).not.toBeInTheDocument();
  expect(screen.getByText('Produto atualizado com sucesso.')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const updates = fetch.mock.calls.filter(([, options]) => options.method === 'PATCH');
  expect(updates).toHaveLength(1);
  expect(updates[0][0]).toMatch(/\/products\/20$/);
  fireEvent.click(screen.getByRole('button', { name: 'Novo produto' }));
  expect(screen.getByRole('dialog', { name: 'Novo produto' })).toBeInTheDocument();
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('');
  expect(screen.getByLabelText(/^SKU/)).toHaveValue('');
  await within(screen.getByRole('dialog', { name: 'Novo produto' })).findByRole('option', { name: 'Vestuário' });
});

test('requires confirmation to delete a product and refreshes its status to inactive', async () => {
  const baseFetch = fetch;
  let selectedProduct = { ...products[0] };
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith('/catalog/products/20') && options.method === 'DELETE') {
      selectedProduct = { ...selectedProduct, status: 'inactive' };
      return Promise.resolve(response(selectedProduct));
    }
    if (url.includes('/catalog/products?')) return Promise.resolve(response(page([selectedProduct, products[1]])));
    return baseFetch(url, options);
  });
  const deletions = () => fetch.mock.calls.filter(([, options]) => options.method === 'DELETE');
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  await screen.findByText('Camiseta API');
  expect(screen.getByRole('button', { name: 'Excluir Tênis API' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: 'camiseta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Camiseta API' }));
  expect(screen.getByRole('alertdialog', { name: 'Excluir produto?' })).toHaveTextContent('SKU-20');
  expect(deletions()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText('Baixo estoque')).toBeInTheDocument();
  expect(deletions()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Camiseta API' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  expect(await screen.findByText('Produto desativado com sucesso.')).toBeInTheDocument();
  const row = (await screen.findByText('Camiseta API')).closest('tr');
  expect(within(row).getByText('Inativo')).toBeInTheDocument();
  expect(within(row).getByRole('button', { name: 'Excluir Camiseta API' })).toBeDisabled();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Pesquisar')).toHaveValue('camiseta');
  expect(screen.getByLabelText('Categoria')).toHaveValue('30');
  expect(deletions()).toHaveLength(1);
  expect(deletions()[0][0]).toMatch(/\/products\/20$/);
});

test('retries a failed catalog refresh after deletion without sending another DELETE', async () => {
  const baseFetch = fetch;
  let deleted = false;
  let failRefresh = true;
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith('/catalog/products/20') && options.method === 'DELETE') {
      deleted = true;
      return Promise.resolve(response({ ...products[0], status: 'inactive' }));
    }
    if (url.includes('/catalog/products?') && deleted) {
      return Promise.resolve(failRefresh ? response({ detail: 'Unavailable' }, 500) : response(page([{ ...products[0], status: 'inactive' }, products[1]])));
    }
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir Camiseta API' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A API está indisponível');
  expect(screen.getByText('Produto desativado com sucesso.')).toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  failRefresh = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  const row = (await screen.findByText('Camiseta API')).closest('tr');
  expect(within(row).getByText('Inativo')).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(1);
});

test('loads clients and counts their non-cancelled orders', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
  expect(await screen.findByText('Mariana Costa')).toBeInTheDocument();
  expect(screen.getByText('2 pedidos')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: 'mariana@example.com' } });
  expect(screen.getByText('Mariana Costa')).toBeInTheDocument();
});

test('requires confirmation to deactivate a client and preserves its order history and search', async () => {
  const baseFetch = fetch;
  let selectedClient = { ...client };
  const inactiveClient = { ...client, id: 11, first_name: 'Bruno', last_name: 'Silva', email: 'bruno@example.com', status: 'inactive' };
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith('/clients/10') && options.method === 'DELETE') {
      selectedClient = { ...selectedClient, status: 'inactive' };
      return Promise.resolve(response(selectedClient));
    }
    if (url.includes('/clients?')) return Promise.resolve(response(page([selectedClient, inactiveClient])));
    return baseFetch(url, options);
  });
  const deletions = () => fetch.mock.calls.filter(([, options]) => options.method === 'DELETE');
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
  await screen.findByText('Mariana Costa');
  expect(screen.getByRole('button', { name: 'Excluir Bruno Silva' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: 'mariana' } });
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Mariana Costa' }));
  expect(screen.getByRole('alertdialog', { name: 'Excluir cliente?' })).toHaveTextContent('mariana@example.com');
  expect(deletions()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText('Ativo')).toBeInTheDocument();
  expect(deletions()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Mariana Costa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  expect(await screen.findByText('Cliente desativado com sucesso.')).toBeInTheDocument();
  const row = (await screen.findByText('Mariana Costa')).closest('tr');
  expect(within(row).getByText('Inativo')).toBeInTheDocument();
  expect(within(row).getByText('2 pedidos')).toBeInTheDocument();
  expect(within(row).getByRole('button', { name: 'Excluir Mariana Costa' })).toBeDisabled();
  expect(screen.getByLabelText('Pesquisar')).toHaveValue('mariana');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(deletions()).toHaveLength(1);
  expect(deletions()[0][0]).toMatch(/\/clients\/10$/);
});

test('retries a failed client list refresh without deactivating the client twice', async () => {
  const baseFetch = fetch;
  let deleted = false;
  let failRefresh = true;
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith('/clients/10') && options.method === 'DELETE') {
      deleted = true;
      return Promise.resolve(response({ ...client, status: 'inactive' }));
    }
    if (url.includes('/clients?') && deleted) {
      return Promise.resolve(failRefresh ? response({ detail: 'Unavailable' }, 500) : response(page([{ ...client, status: 'inactive' }])));
    }
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir Mariana Costa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A API está indisponível');
  expect(screen.getByText('Cliente desativado com sucesso.')).toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  failRefresh = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  const row = (await screen.findByText('Mariana Costa')).closest('tr');
  expect(within(row).getByText('Inativo')).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(1);
});

test('creates a client from the clients screen and refreshes the list clearing its search', async () => {
  const baseFetch = fetch;
  let createdClient;
  global.fetch = jest.fn((url, options) => {
    if (url.includes('/clients?')) {
      if (options.method === 'POST') {
        createdClient = { ...JSON.parse(options.body), id: 11, status: 'active', filial_id: 7 };
        return Promise.resolve(response(createdClient, 201));
      }
      return Promise.resolve(response(page(createdClient ? [client, createdClient] : [client])));
    }
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
  await screen.findByText('Mariana Costa');
  fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: 'mariana' } });
  fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));
  const dialog = screen.getByRole('dialog', { name: 'Novo cliente' });
  fireEvent.change(within(dialog).getByLabelText(/^Nome/), { target: { value: 'Ana' } });
  fireEvent.change(within(dialog).getByLabelText(/^Sobrenome/), { target: { value: 'Silva' } });
  fireEvent.change(within(dialog).getByLabelText(/^E-mail/), { target: { value: 'ana@example.com' } });
  fireEvent.change(within(dialog).getByLabelText(/^CPF/), { target: { value: '12345678909' } });
  fireEvent.submit(within(dialog).getByRole('button', { name: 'Salvar cliente' }).closest('form'));
  expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
  expect(screen.getByText('Cliente cadastrado com sucesso.')).toBeInTheDocument();
  expect(screen.getByText('0 pedidos')).toBeInTheDocument();
  expect(screen.getByLabelText('Pesquisar')).toHaveValue('');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(fetch.mock.calls.filter(([url, options]) => url.includes('/clients?') && options.method === 'POST')).toHaveLength(1);
});

test('allows opening a new client form when the clients list fails to load', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.includes('/clients?') ? Promise.resolve(response({ detail: 'Unavailable' }, 500)) : baseFetch(url, options));
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));
  expect(screen.getByRole('dialog', { name: 'Novo cliente' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('cancels client edits without saving and then updates only the selected client in the list', async () => {
  const baseFetch = fetch;
  let savedClient = { ...client };
  const otherClient = { ...client, id: 11, first_name: 'Bruno', last_name: 'Silva', email: 'bruno@example.com' };
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith('/clients/10') && options.method === 'PATCH') {
      savedClient = { ...savedClient, ...JSON.parse(options.body) };
      return Promise.resolve(response(savedClient));
    }
    if (url.includes('/clients?')) return Promise.resolve(response(page([savedClient, otherClient])));
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Mariana Costa' }));
  expect(screen.getByRole('dialog', { name: 'Editar cliente' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Rascunho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Mariana Costa')).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Editar Mariana Costa' }));
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Mariana');
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Marina' } });
  fireEvent.change(screen.getByLabelText(/^Telefone/), { target: { value: '(11) 99999-8888' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar alterações' }).closest('form'));
  expect(await screen.findByText('Marina Costa')).toBeInTheDocument();
  expect(screen.getByText('(11) 99999-8888')).toBeInTheDocument();
  expect(screen.getByText('Cliente atualizado com sucesso.')).toBeInTheDocument();
  expect(screen.getByText('Bruno Silva')).toBeInTheDocument();
  expect(screen.queryByText('Mariana Costa')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const updates = fetch.mock.calls.filter(([, options]) => options.method === 'PATCH');
  expect(updates).toHaveLength(1);
  expect(updates[0][0]).toMatch(/\/clients\/10$/);
  fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));
  expect(screen.getByRole('dialog', { name: 'Novo cliente' })).toBeInTheDocument();
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('');
  expect(screen.getByLabelText(/^CPF/)).toHaveValue('');
});

test('creates a category and makes it available in the product form', async () => {
  const baseFetch = fetch;
  let createdCategory;
  global.fetch = jest.fn((url, options) => {
    if (url.includes('/catalog/categories?')) {
      if (options.method === 'POST') {
        createdCategory = { ...JSON.parse(options.body), id: 32, company_id: 2 };
        return Promise.resolve(response(createdCategory, 201));
      }
      return Promise.resolve(response(page(createdCategory ? [...categories, createdCategory] : categories)));
    }
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^categorias$/i }));
  await screen.findByRole('heading', { name: 'Vestuário' });
  fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
  await screen.findByRole('option', { name: 'Moda' });
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Acessórios' } });
  fireEvent.change(screen.getByLabelText(/^Departamento/), { target: { value: '5' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar categoria' }).closest('form'));
  const card = (await screen.findByRole('heading', { name: 'Acessórios' })).closest('article');
  expect(within(card).getByText('0 produtos')).toBeInTheDocument();
  expect(screen.getByText('Categoria cadastrada com sucesso.')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  await screen.findByText('Camiseta API');
  fireEvent.click(screen.getByRole('button', { name: 'Novo produto' }));
  const dialog = screen.getByRole('dialog', { name: 'Novo produto' });
  const option = await within(dialog).findByRole('option', { name: 'Acessórios' });
  expect(option).toHaveValue('32');
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST' && options.headers['Content-Type'] === 'application/json')).toHaveLength(1);
});

test('cancels category edits and updates the selected category while explaining unavailable deletion', async () => {
  const baseFetch = fetch;
  let savedCategory = { ...categories[1] };
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith('/catalog/categories/31') && options.method === 'PATCH') {
      savedCategory = { ...savedCategory, ...JSON.parse(options.body) };
      return Promise.resolve(response(savedCategory));
    }
    if (url.includes('/catalog/categories?')) return Promise.resolve(response(page([categories[0], savedCategory])));
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^categorias$/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Calçados' }));
  await screen.findByRole('option', { name: 'Moda' });
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Calçados');
  expect(screen.getByLabelText(/^Departamento/)).toHaveValue('5');
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Rascunho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByRole('heading', { name: 'Calçados' })).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Editar Calçados' }));
  await screen.findByRole('option', { name: 'Moda' });
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Calçados');
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Sapatos' } });
  fireEvent.change(screen.getByLabelText(/^Departamento/), { target: { value: '6' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar alterações' }).closest('form'));
  const card = (await screen.findByRole('heading', { name: 'Sapatos' })).closest('article');
  expect(within(card).getByText('1 produtos')).toBeInTheDocument();
  expect(screen.getByText('Categoria atualizada com sucesso.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Vestuário' })).toBeInTheDocument();
  const deleteButton = within(card).getByRole('button', { name: 'Excluir Sapatos' });
  expect(deleteButton).toBeDisabled();
  expect(deleteButton).toHaveAccessibleDescription('A exclusão de categorias ainda não está disponível neste servidor.');
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(0);
  const updates = fetch.mock.calls.filter(([, options]) => options.method === 'PATCH');
  expect(updates).toHaveLength(1);
  expect(updates[0][0]).toMatch(/\/categories\/31$/);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Sapatos' }));
  expect(await screen.findByText('Tênis API')).toBeInTheDocument();
  expect(screen.getByLabelText('Categoria')).toHaveValue('31');
});

test('permits opening the category form when the category list is unavailable', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.includes('/catalog/categories?') ? Promise.resolve(response({ detail: 'Unavailable' }, 500)) : baseFetch(url, options));
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^categorias$/i }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
  expect(screen.getByRole('dialog', { name: 'Nova categoria' })).toBeInTheDocument();
  await screen.findByRole('option', { name: 'Moda' });
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('opens a category in the products screen with its filter selected', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^categorias$/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir Vestuário' }));
  expect(await screen.findByText('Camiseta API')).toBeInTheDocument();
  expect(screen.getByLabelText('Categoria')).toHaveValue('30');
  expect(screen.queryByText('Tênis API')).not.toBeInTheDocument();
});

test('shows sale totals excluding cancelled orders and filters by payment status', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^vendas$/i }));
  expect(await screen.findByText('#40')).toBeInTheDocument();
  expect(screen.getByText(/30,50/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'paid' } });
  expect(await screen.findByText('#40')).toBeInTheDocument();
  expect(screen.queryByText('#41')).not.toBeInTheDocument();
  expect(screen.queryByText('#42')).not.toBeInTheDocument();
});

test('uses the last sale date, formats analytics ratios and reloads the selected period', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^relatórios$/i }));
  expect(await screen.findByText(/9,63% vs período anterior/)).toBeInTheDocument();
  const metric = screen.getByText('Itens vendidos').closest('article');
  expect(within(metric).getByText('5')).toBeInTheDocument();
  const initialUrl = fetch.mock.calls.find(([url]) => url.includes('/analytics/sales/compare'))[0];
  const initialParams = new URL(initialUrl, 'http://localhost').searchParams;
  expect(initialParams.get('filial_id')).toBe('7');
  expect(initialParams.get('start_date')).toBe('2026-10-03');
  expect(initialParams.get('end_date')).toBe('2026-10-30');
  fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'previous' } });
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.includes('/analytics/sales/compare'))).toHaveLength(2));
  const previousUrl = fetch.mock.calls.filter(([url]) => url.includes('/analytics/sales/compare'))[1][0];
  expect(new URL(previousUrl, 'http://localhost').searchParams.get('end_date')).not.toBe(initialParams.get('end_date'));
});

test('aborts pending data requests when navigating away', async () => {
  const baseFetch = fetch;
  let productSignal;
  global.fetch = jest.fn((url, options) => {
    if (url.includes('/catalog/products?')) {
      productSignal = options.signal;
      return new Promise(() => {});
    }
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  await waitFor(() => expect(productSignal).toBeDefined());
  fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
  expect(productSignal.aborted).toBe(true);
  expect(await screen.findByText('Mariana Costa')).toBeInTheDocument();
});

test('shows an empty table when the API has no products', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.includes('/catalog/products?') ? Promise.resolve(response(page([]))) : baseFetch(url, options));
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  expect(await screen.findByText('Nenhum registro encontrado.')).toBeInTheDocument();
  expect(screen.queryByText('Camiseta Essential')).not.toBeInTheDocument();
});

test('keeps the user logged in when a branch request is forbidden', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.includes('/catalog/products?') ? Promise.resolve(response({ detail: 'Forbidden' }, 403)) : baseFetch(url, options));
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^produtos$/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
  expect(getAccessToken()).toBe('test-token');
});

test('downloads the documented reports from the existing export button', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:reports');
  URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^relatórios$/i }));
  await screen.findByText(/9,63% vs período anterior/);
  fireEvent.click(screen.getByRole('button', { name: /^exportar relatório$/i }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
});

test('shows forecast ratios and its training date without confusing zero with missing accuracy', async () => {
  render(<App />);
  await signIn();
  expect(await screen.findByText('14,62%')).toBeInTheDocument();
  expect(screen.getByText(/2,89% vs histórico equivalente/)).toBeInTheDocument();
  expect(screen.getByText(/Período previsto após 30\/10\/2026/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Horizonte da previsão'), { target: { value: '14' } });
  expect(screen.getByText(/0% vs histórico equivalente/)).toBeInTheDocument();
  expect(screen.getByText('Dias 8 a 14: —')).toBeInTheDocument();
  const quantity = screen.getByText('Quantidade prevista — 14 dias').closest('article');
  expect(within(quantity).getByText('200')).toBeInTheDocument();
});

test('changes forecast target and model using only parameters supported by each route', async () => {
  render(<App />);
  await signIn();
  await screen.findByText('14,62%');
  fireEvent.change(screen.getByLabelText('Alvo da previsão'), { target: { value: 'revenue' } });
  fireEvent.change(screen.getByLabelText('Modelo da previsão'), { target: { value: 'moving_average' } });
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('/forecasts/compare?') && url.includes('target=revenue') && url.includes('model=moving_average'))).toBe(true));
  const summaryUrl = fetch.mock.calls.filter(([url]) => url.includes('/forecasts/summary?')).pop()[0];
  expect(summaryUrl).not.toContain('target=');
  expect(summaryUrl).not.toContain('history_days=');
  await screen.findByText('16,26%');
});

test('retains real indicators when no forecast has been generated', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.includes('/forecasts/') ? Promise.resolve(response({ detail: 'Previsão ainda não gerada' }, 404)) : baseFetch(url, options));
  render(<App />);
  await signIn();
  expect(await screen.findByText(/Previsões ainda não geradas/)).toBeInTheDocument();
  expect(screen.getByText(/123,45/)).toBeInTheDocument();
  expect(getAccessToken()).toBe('test-token');
});

test('does not request consolidated charts or forecasts when the branch has no sales data', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.includes('/analytics/status?') ? Promise.resolve(response({ last_sale_date: null, last_day: null })) : baseFetch(url, options));
  render(<App />);
  await signIn();
  await screen.findByText('Sem dados de vendas ainda.');
  fireEvent.click(screen.getByRole('button', { name: /^relatórios$/i }));
  await screen.findByText('Sem dados de vendas ainda.');
  expect(fetch.mock.calls.some(([url]) => url.includes('/analytics/sales/'))).toBe(false);
  expect(fetch.mock.calls.some(([url]) => url.includes('/forecasts/compare'))).toBe(false);
  expect(screen.queryByText('Itens vendidos')).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Receita líquida consolidada por dia' })).not.toBeInTheDocument();
});

test('warns when the latest analytics job failed', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn(async (url, options) => {
    if (url.includes('/analytics/status?')) return response({ last_sale_date: '2026-10-30', last_day: '2026-10-30', last_job: { status: 'failed' } });
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent(/última atualização falhou/i);
});

test('blocks future data ranges and unpaired comparison dates before requesting analytics', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^relatórios$/i }));
  await screen.findByText(/9,63% vs período anterior/);
  const count = fetch.mock.calls.filter(([url]) => url.includes('/analytics/sales/compare')).length;
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-31' } });
  expect(screen.getByRole('alert')).toHaveTextContent(/Não há dados de vendas após 30\/10\/2026/);
  expect(fetch.mock.calls.filter(([url]) => url.includes('/analytics/sales/compare'))).toHaveLength(count);
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-30' } });
  await screen.findByText(/9,63% vs período anterior/);
  fireEvent.change(screen.getByLabelText('Comparação inicial'), { target: { value: '2026-09-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent(/duas datas de comparação/);
  fireEvent.change(screen.getByLabelText('Comparação final'), { target: { value: '2026-09-28' } });
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('compare_start_date=2026-09-01') && url.includes('compare_end_date=2026-09-28'))).toBe(true));
  await screen.findByText(/9,63% vs período anterior/);
});

test('queries the selected category for sales and forecasts and uses entity names', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^relatórios$/i }));
  await screen.findByText(/9,63% vs período anterior/);
  fireEvent.change(screen.getByLabelText('Nível da análise'), { target: { value: 'category' } });
  await screen.findByRole('option', { name: 'Vestuário' });
  fireEvent.change(screen.getByLabelText('Entidade da análise'), { target: { value: '30' } });
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('/analytics/sales/compare?') && url.includes('level=category') && url.includes('entity_id=30'))).toBe(true));
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('/forecasts/compare?') && url.includes('level=category') && url.includes('entity_id=30'))).toBe(true));
  await screen.findByText(/9,63% vs período anterior/);
});

test('switches ranking metric and opens a stockout product history', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^relatórios$/i }));
  await screen.findByText('Líder de vendas');
  expect(screen.getByText('11,09%')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Métrica do ranking'), { target: { value: 'margin' } });
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('/analytics/sales/ranking?') && url.includes('metric=margin'))).toBe(true));
  fireEvent.click(await screen.findByRole('button', { name: 'Ver estoque de Produto em ruptura' }));
  expect(await screen.findByRole('img', { name: 'Estoque diário de Produto em ruptura' })).toBeInTheDocument();
  expect(fetch.mock.calls.find(([url]) => url.includes('/analytics/stock/daily?'))[0]).toContain('product_id=20');
});

test('loads confidence evaluations only on demand', async () => {
  render(<App />);
  await signIn();
  await screen.findByText('14,62%');
  expect(fetch.mock.calls.some(([url]) => url.includes('/forecasts/backtest?'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Ver avaliação dos modelos' }));
  expect(await screen.findByRole('img', { name: 'Previsão retroativa e vendas realizadas' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'WAPE' })).toBeInTheDocument();
  expect(fetch.mock.calls.find(([url]) => url.includes('/forecasts/accuracy?'))[0]).toContain('level=filial');
});

test('lists accessible users through the current users endpoint', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /usuários/i }));
  expect(await screen.findByText('Equipe API')).toBeInTheDocument();
  const url = fetch.mock.calls.find(([value]) => value.includes('/users?'))[0];
  expect(url).not.toContain('filial_id');
});

test('shows the allocated discount and net item revenue in order details', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.endsWith('/orders/40') ? Promise.resolve(response({ id: 40, discount: '5.00', total: '45.00', items: [{ product_id: 20, quantity: 2, total: '50.00', discount_allocated: '5.00', net_total: '45.00' }] })) : baseFetch(url, options));
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^vendas$/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ver itens do pedido 40' }));
  const dialog = await screen.findByRole('dialog', { name: 'Itens do pedido #40' });
  expect(await within(dialog).findByRole('columnheader', { name: 'Receita líquida' })).toBeInTheDocument();
  const row = within(dialog).getByText('#20').closest('tr');
  expect(within(row).getByText(/45,00/)).toBeInTheDocument();
  expect(within(row).getByText(/50,00/)).toBeInTheDocument();
});

test('loads sales in pages while keeping server summary metrics for the full month', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => {
    if (url.includes('/orders?')) {
      const params = new URL(url, 'http://localhost').searchParams;
      const items = params.get('offset') === '50' ? [{ ...orders[0], id: 999 }] : Array.from({ length: 50 }, (_, index) => ({ ...orders[0], id: 40 + index }));
      return Promise.resolve(response({ items, total: 51, limit: 50, offset: Number(params.get('offset')) }));
    }
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^vendas$/i }));
  expect(await screen.findByText('1–50 de 51')).toBeInTheDocument();
  expect(screen.getByText(/30,50/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  expect(await screen.findByText('#999')).toBeInTheDocument();
  expect(screen.getByText('51–51 de 51')).toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => url.includes('/orders?') && url.includes('limit=50') && url.includes('offset=50'))).toBe(true);
  expect(screen.getByText(/30,50/)).toBeInTheDocument();
});

test('opens the invitation form, creates a user and refreshes the team list', async () => {
  const baseFetch = fetch;
  let created = null;
  global.fetch = jest.fn((url, options) => {
    const path = new URL(url, 'http://localhost').pathname;
    if (path.endsWith('/users')) {
      if (options.method === 'POST') {
        const payload = JSON.parse(options.body);
        created = { id: 55, username: payload.username, full_name: payload.full_name, email: payload.email, is_active: true, is_superuser: false, last_login: null, groups: [{ id: 2, name: 'Vendedor' }] };
        return Promise.resolve(response({ ...created, password_hash: 'never-display' }, 201));
      }
      return Promise.resolve(response(page([{ ...user, full_name: 'Equipe API', is_active: true }, ...(created ? [created] : [])])));
    }
    return baseFetch(url, options);
  });
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /usuários/i }));
  await screen.findByText('Equipe API');
  fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: 'Equipe API' } });
  fireEvent.click(screen.getByRole('button', { name: 'Convidar usuário' }));
  expect(screen.getByRole('dialog', { name: 'Convidar usuário' })).toBeInTheDocument();
  await screen.findByRole('checkbox', { name: 'Vendedor' });
  fireEvent.change(screen.getByLabelText(/^Nome completo/), { target: { value: 'Nova Colega' } });
  fireEvent.change(screen.getByLabelText(/^Login/), { target: { value: 'nova.colega' } });
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'colega@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Senha inicial/), { target: { value: 'test-secret' } });
  fireEvent.change(screen.getByLabelText(/^Confirmar senha/), { target: { value: 'test-secret' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Vendedor' }));
  fireEvent.submit(screen.getByRole('button', { name: 'Cadastrar usuário' }).closest('form'));
  expect(await screen.findByText('Usuário cadastrado com sucesso.')).toBeInTheDocument();
  expect(await screen.findByText('Nova Colega')).toBeInTheDocument();
  expect(screen.getByLabelText('Pesquisar')).toHaveValue('');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('never-display')).not.toBeInTheDocument();
  const [url, options] = fetch.mock.calls.find(([value, requestOptions]) => value.endsWith('/users') && requestOptions.method === 'POST');
  expect(url).not.toContain('filial_id=');
  expect(JSON.parse(options.body)).toMatchObject({ group_ids: [2], filial_ids: [7] });
});
