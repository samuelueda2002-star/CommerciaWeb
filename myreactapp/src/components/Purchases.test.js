import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Purchases from './Purchases';
import { clearAccessToken, getAccessToken, saveAccessToken } from '../api/client';

jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ session: { filialId: 7 } }) }));

const purchase = {
  id: 10, supplier_id: 30, filial_id: 7, status: 'received', total: '95.00', discount: '10.00', freight: '5.00',
  invoice_number: 'NF-123', invoice_key: '1'.repeat(44), issued_at: '2026-11-15', notes: 'Conferir embalagem',
  occurred_at: '2026-11-16T20:00:00-03:00', created_at: '2026-11-17T13:00:00Z', received_at: '2026-11-17T13:00:00Z',
  client_reference: '34503ddd-56ec-4a6c-8712-ce04aab32bc2',
  items: [{ product_id: 20, quantity: 2, unit_cost: '50.00', total: '100.00', discount_allocated: '10.00', freight_allocated: '5.00', net_total: '95.00', landed_unit_cost: '47.50' }],
};
const pending = { ...purchase, id: 11, invoice_number: 'NF-124', status: 'pending', client_reference: null, received_at: null };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });
const page = (items) => ({ items, total: items.length, limit: 50, offset: 0 });

beforeEach(() => {
  saveAccessToken('test-purchases-token');
  global.fetch = jest.fn(async (url) => {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.pathname.endsWith('/purchases')) {
      const items = [purchase, pending].filter((item) => !parsed.searchParams.get('status') || item.status === parsed.searchParams.get('status'));
      return response(page(items));
    }
    if (parsed.pathname.endsWith('/people')) return response(page([{ id: 30, display_name: 'Fornecedor API' }]));
    if (parsed.pathname.endsWith('/catalog/products/20')) return response({ id: 20, name: 'Produto da compra' });
    if (parsed.pathname.endsWith('/purchases/10')) return response(purchase);
    if (parsed.pathname.endsWith('/purchases/11')) return response(pending);
    return response({ detail: 'Not found' }, 404);
  });
});
afterEach(() => { clearAccessToken(); jest.restoreAllMocks(); });

test('shows real purchase statuses, invoice, supplier and the sync origin without mutating records', async () => {
  render(<Purchases />);
  expect(await screen.findByText('NF-123')).toBeInTheDocument();
  expect(screen.getByText('Aplicativo (sync)')).toBeInTheDocument();
  expect(screen.getByText('Recebida')).toBeInTheDocument();
  expect(screen.getByText('Pendente')).toBeInTheDocument();
  expect(screen.getAllByText('Fornecedor API')).toHaveLength(3);
  expect(fetch.mock.calls.every(([, options]) => options.method === undefined)).toBe(true);
});

test('uses API filters and searches invoice references within the loaded page', async () => {
  render(<Purchases />);
  await screen.findByText('NF-123');
  fireEvent.change(screen.getByLabelText('Pesquisar compra nesta página'), { target: { value: 'NF-124' } });
  expect(screen.queryByText('NF-123')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Pesquisar compra nesta página'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Situação das compras'), { target: { value: 'pending' } });
  await screen.findByText('NF-124');
  expect(screen.queryByText('NF-123')).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => url.includes('/purchases?') && url.includes('status=pending'))).toBe(true);
});

test('shows gross and net costs, freight, discount and the existing receiving state during conference', async () => {
  render(<Purchases />);
  fireEvent.click(await screen.findByRole('button', { name: 'Conferir compra 10' }));
  const dialog = screen.getByRole('dialog', { name: 'Conferir compra #10' });
  expect(await within(dialog).findByText('Produto da compra')).toBeInTheDocument();
  expect(within(dialog).getByText(/entrada no estoque já foi registrada/)).toBeInTheDocument();
  const row = within(dialog).getByText('Produto da compra').closest('tr');
  expect(within(row).getByText(/100,00/)).toBeInTheDocument();
  expect(within(row).getByText(/95,00/)).toBeInTheDocument();
  expect(within(row).getByText(/47,50/)).toBeInTheDocument();
  expect(within(dialog).getByText(/Referência do aplicativo/)).toHaveTextContent(purchase.client_reference);
  expect(within(dialog).queryByRole('button', { name: /confirmar recebimento/i })).not.toBeInTheDocument();
  expect(fetch.mock.calls.every(([, options]) => options.method === undefined)).toBe(true);
});

test('retains purchase access when supplier lookup is forbidden and allows retry', async () => {
  const baseFetch = fetch;
  let fail = true;
  global.fetch = jest.fn((url, options) => url.includes('/people?') && fail ? Promise.resolve(response({ detail: 'Forbidden' }, 403)) : baseFetch(url, options));
  render(<Purchases />);
  expect(await screen.findByText('NF-123')).toBeInTheDocument();
  expect(screen.getAllByText('Fornecedor #30')).toHaveLength(2);
  expect(getAccessToken()).toBe('test-purchases-token');
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar fornecedores' }));
  await screen.findByRole('option', { name: 'Fornecedor API' });
});

test('blocks a reversed date range without requesting an invalid purchase period', async () => {
  render(<Purchases />);
  await screen.findByText('NF-123');
  fireEvent.change(screen.getByLabelText('Data inicial das compras'), { target: { value: '2026-11-20' } });
  await screen.findByText('NF-123');
  const count = fetch.mock.calls.filter(([url]) => url.includes('/purchases?')).length;
  fireEvent.change(screen.getByLabelText('Data final das compras'), { target: { value: '2026-11-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent(/data final/);
  expect(fetch.mock.calls.filter(([url]) => url.includes('/purchases?'))).toHaveLength(count);
});

test('loads pages forward and back without resetting the previous page to zero', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => {
    if (new URL(url, 'http://localhost').pathname.endsWith('/purchases')) {
      const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset'));
      const count = offset === 100 ? 1 : 50;
      return Promise.resolve(response({ items: Array.from({ length: count }, (_, index) => ({ ...purchase, id: offset + index + 1, invoice_number: `NF-${offset + index + 1}` })), total: 101, limit: 50, offset }));
    }
    return baseFetch(url, options);
  });
  render(<Purchases />);
  await screen.findByText('1–50 de 101');
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await screen.findByText('51–100 de 101');
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await screen.findByText('101–101 de 101');
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  expect(await screen.findByText('51–100 de 101')).toBeInTheDocument();
});

test('reports an API failure without presenting an empty list as a successful result', async () => {
  const baseFetch = fetch;
  let fail = true;
  global.fetch = jest.fn((url, options) => url.includes('/purchases?') && fail ? Promise.resolve(response({ detail: 'Unavailable' }, 500)) : baseFetch(url, options));
  render(<Purchases />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/API está indisponível/);
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByText('NF-123');
});

test('refreshes the list after new app purchases arrive', async () => {
  render(<Purchases />);
  await screen.findByText('NF-123');
  const count = fetch.mock.calls.filter(([url]) => url.includes('/purchases?')).length;
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista' }));
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.includes('/purchases?'))).toHaveLength(count + 1));
  await screen.findByText('NF-123');
});

test('confirms a reviewed pending receipt and refreshes the pending queue', async () => {
  const baseFetch = fetch;
  let received = false;
  global.fetch = jest.fn((url, options) => {
    const path = new URL(url, 'http://localhost').pathname;
    if (path.endsWith('/purchases/11/receive')) {
      received = true;
      return Promise.resolve(response({ ...pending, status: 'received' }));
    }
    if (path.endsWith('/purchases') && received) return Promise.resolve(response(page([])));
    return baseFetch(url, options);
  });
  render(<Purchases />);
  await screen.findByText('NF-124');
  fireEvent.change(screen.getByLabelText('Situação das compras'), { target: { value: 'pending' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Conferir compra 11' }));
  await screen.findByText('Produto da compra');
  fireEvent.click(screen.getByRole('checkbox', { name: /Conferi os itens/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
  expect(await screen.findByText('Recebimento da compra #11 confirmado. Entrada no estoque registrada.')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(await screen.findByText('Nenhuma compra encontrada.')).toBeInTheDocument();
  expect(screen.getByLabelText('Situação das compras')).toHaveValue('pending');
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
});
