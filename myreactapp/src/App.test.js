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
    const path = new URL(url, 'http://localhost').pathname.replace('/api/v1', '');
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
    if (path.endsWith('/sales-summary')) return response({ total_revenue: '30.50', average_ticket: '15.25', total_orders: 3, cancellation_rate: 33.33 });
    if (path.endsWith('/sales-comparison')) return response({ revenue_change_pct: -10, orders_change_pct: null });
    if (path.endsWith('/sales-by-category')) return response([{ quantity_sold: 5, total_revenue: '30.50' }]);
    if (path.endsWith('/sales-by-weekday')) return response([{ weekday: 0, total: '30.50' }]);
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
  expect(screen.getByText('#40')).toBeInTheDocument();
  expect(screen.queryByText('#41')).not.toBeInTheDocument();
  expect(screen.queryByText('#42')).not.toBeInTheDocument();
});

test('passes report dates and branch, and reloads when the period changes', async () => {
  render(<App />);
  await signIn();
  fireEvent.click(screen.getByRole('button', { name: /^relatórios$/i }));
  expect(await screen.findByText(/15,25/)).toBeInTheDocument();
  const metric = screen.getByText('Itens vendidos').closest('article');
  expect(within(metric).getByText('5')).toBeInTheDocument();
  const initialUrl = fetch.mock.calls.find(([url]) => url.includes('/sales-comparison'))[0];
  const initialParams = new URL(initialUrl, 'http://localhost').searchParams;
  expect(initialParams.get('filial_id')).toBe('7');
  expect(initialParams.get('start_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'previous' } });
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.includes('/sales-comparison'))).toHaveLength(2));
  const previousUrl = fetch.mock.calls.filter(([url]) => url.includes('/sales-comparison'))[1][0];
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
  await screen.findByText(/15,25/);
  fireEvent.click(screen.getByRole('button', { name: /^exportar relatório$/i }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
});
