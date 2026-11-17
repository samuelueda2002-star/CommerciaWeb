import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PurchaseDetails from './PurchaseDetails';
import { clearAccessToken, getAccessToken, saveAccessToken } from '../api/client';

const purchase = {
  id: 11, filial_id: 7, supplier_id: 30, status: 'pending', invoice_number: 'NF-124',
  total: '95.00', discount: '10.00', freight: '5.00', updated_at: '2026-11-17T13:00:00Z',
  items: [{ product_id: 20, quantity: 2, unit_cost: '50.00', total: '100.00', discount_allocated: '10.00', freight_allocated: '5.00', net_total: '95.00', landed_unit_cost: '47.50' }],
};
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });
const mutations = () => fetch.mock.calls.filter(([, options]) => options.method === 'POST');

function openDetails() {
  const onClose = jest.fn();
  const onReceived = jest.fn();
  const view = render(<PurchaseDetails purchaseId={11} filialId={7} supplierName="Fornecedor API" onClose={onClose} onReceived={onReceived} />);
  return { ...view, onClose, onReceived };
}

async function acknowledge() {
  await screen.findByText('Produto API');
  fireEvent.click(screen.getByRole('checkbox', { name: /Conferi os itens/ }));
}

beforeEach(() => {
  saveAccessToken('test-purchases-token');
  global.fetch = jest.fn(async (url) => {
    if (url.endsWith('/purchases/11/receive')) return response({ ...purchase, status: 'received' });
    if (url.endsWith('/purchases/11')) return response(purchase);
    if (url.endsWith('/catalog/products/20')) return response({ id: 20, name: 'Produto API' });
    return response({ detail: 'Not found' }, 404);
  });
});
afterEach(() => { clearAccessToken(); jest.restoreAllMocks(); });

test('requires a conscious item and quantity check before receiving', async () => {
  const { onReceived } = openDetails();
  await screen.findByText('Produto API');
  const confirm = screen.getByRole('button', { name: 'Confirmar recebimento' });
  expect(confirm).toBeDisabled();
  expect(screen.getByText(/todos os itens desta compra entram no estoque/)).toBeInTheDocument();
  fireEvent.submit(confirm.closest('form'));
  expect(mutations()).toHaveLength(0);
  await acknowledge();
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  await waitFor(() => expect(onReceived).toHaveBeenCalledWith(expect.objectContaining({ id: 11, status: 'received' })));
  expect(mutations()).toHaveLength(1);
});

test('prevents duplicate confirmations and closing while a receiving request is pending', async () => {
  const baseFetch = fetch;
  let complete;
  global.fetch = jest.fn((url, options) => url.endsWith('/receive') ? new Promise((resolve) => { complete = resolve; }) : baseFetch(url, options));
  const { onClose, onReceived } = openDetails();
  await acknowledge();
  const form = screen.getByRole('button', { name: 'Confirmar recebimento' }).closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(screen.getByRole('button', { name: 'Confirmando...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Fechar compra' })).toBeDisabled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
  expect(mutations()).toHaveLength(1);
  await act(async () => complete(response({ ...purchase, status: 'received' })));
  expect(onReceived).toHaveBeenCalledTimes(1);
});

test('closing a reviewed purchase sends no receipt request', async () => {
  const { onClose, onReceived } = openDetails();
  await acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onReceived).not.toHaveBeenCalled();
  expect(mutations()).toHaveLength(0);
});

test.each(['received', 'cancelled'])('uses the fresh detail state and offers no receipt for a %s purchase', async (status) => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.endsWith('/purchases/11') ? Promise.resolve(response({ ...purchase, status })) : baseFetch(url, options));
  openDetails();
  await screen.findByText('Produto API');
  expect(screen.queryByRole('button', { name: 'Confirmar recebimento' })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(mutations()).toHaveLength(0);
});

test.each([{ filial_id: 99 }, { id: 99 }, { items: [] }])('withholds receiving when the selected detail cannot be reviewed (%j)', async (changes) => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.endsWith('/purchases/11') ? Promise.resolve(response({ ...purchase, ...changes })) : baseFetch(url, options));
  openDetails();
  await screen.findByText('NF-124');
  expect(screen.queryByRole('button', { name: 'Confirmar recebimento' })).not.toBeInTheDocument();
  expect(mutations()).toHaveLength(0);
});

test('keeps the session and requires reviewing again after receiving is forbidden', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.endsWith('/receive') ? Promise.resolve(response({ detail: 'Forbidden' }, 403)) : baseFetch(url, options));
  const { onReceived } = openDetails();
  await acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/);
  await screen.findByText('Produto API');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Confirmar recebimento' })).toBeDisabled();
  expect(getAccessToken()).toBe('test-purchases-token');
  expect(onReceived).not.toHaveBeenCalled();
  expect(mutations()).toHaveLength(1);
});

test('reloads the purchase after a concurrent receipt conflict without repeating the POST', async () => {
  const baseFetch = fetch;
  let conflicted = false;
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith('/receive')) {
      conflicted = true;
      return Promise.resolve(response({ detail: 'Compra já recebida por outro usuário.' }, 409));
    }
    if (url.endsWith('/purchases/11') && conflicted) return Promise.resolve(response({ ...purchase, status: 'received' }));
    return baseFetch(url, options);
  });
  const { onReceived } = openDetails();
  await acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
  expect(await screen.findByText(/entrada no estoque já foi registrada/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirmar recebimento' })).not.toBeInTheDocument();
  expect(onReceived).not.toHaveBeenCalled();
  expect(mutations()).toHaveLength(1);
});

test('checks server state after a lost response before allowing another deliberate attempt', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.endsWith('/receive') ? Promise.reject(new TypeError('Network failure')) : baseFetch(url, options));
  const { onReceived } = openDetails();
  await acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível conectar/);
  await screen.findByText('Produto API');
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/purchases/11'))).toHaveLength(2);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Confirmar recebimento' })).toBeDisabled();
  expect(onReceived).not.toHaveBeenCalled();
  expect(mutations()).toHaveLength(1);
});

test('aborts an outstanding receipt request when leaving the screen', async () => {
  const baseFetch = fetch;
  let receiptSignal;
  global.fetch = jest.fn((url, options) => {
    if (!url.endsWith('/receive')) return baseFetch(url, options);
    receiptSignal = options.signal;
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  });
  const { unmount, onReceived } = openDetails();
  await acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
  unmount();
  expect(receiptSignal.aborted).toBe(true);
  await act(async () => {});
  expect(onReceived).not.toHaveBeenCalled();
});
