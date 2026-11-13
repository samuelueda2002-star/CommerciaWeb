import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderForm from './OrderForm';
import { clearAccessToken, saveAccessToken } from '../api/client';

const clients = [
  { id: 10, first_name: 'Cliente', last_name: 'Ativo', status: 'active' },
  { id: 11, first_name: 'Cliente', last_name: 'Inativo', status: 'inactive' },
];
const products = [
  { id: 20, name: 'Produto ativo', status: 'active' },
  { id: 21, name: 'Produto inativo', status: 'inactive' },
];
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });
const page = (items) => ({ items, total: items.length });
const postCalls = () => fetch.mock.calls.filter(([, options]) => options.method === 'POST');

async function fillOrder() {
  await screen.findByRole('option', { name: /Produto ativo/ });
  fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Produto 1'), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Quantidade 1'), { target: { value: '2' } });
}

function submit() {
  fireEvent.submit(screen.getByRole('button', { name: 'Registrar venda' }).closest('form'));
}

beforeEach(() => {
  saveAccessToken('test-order-token');
  global.fetch = jest.fn(async (url, options) => {
    if (options.method === 'POST') return response({ id: 40, total: '45.00', status: 'pending' }, 201);
    if (url.includes('/clients?')) return response(page(clients));
    if (url.includes('/catalog/products?')) return response(page(products));
    if (url.endsWith('/prices/current')) return response({ price_default: '25.00', price_offer: '0.00' });
    if (url.endsWith('/stock')) return response({ quantity: 4 });
    return response({});
  });
});

afterEach(() => {
  clearAccessToken();
  jest.restoreAllMocks();
});

test('creates an online order with a two-decimal discount and only the audited contract fields', async () => {
  const onSaved = jest.fn();
  render(<OrderForm filialId={7} onClose={jest.fn()} onSaved={onSaved} />);
  await fillOrder();
  expect(screen.queryByRole('option', { name: 'Cliente Inativo' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Produto inativo/ })).not.toBeInTheDocument();
  expect(screen.getByText(/50,00/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Desconto (R$)'), { target: { value: '5,00' } });
  submit();
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 40, total: '45.00', status: 'pending' }));
  const [url, options] = postCalls()[0];
  expect(url).toMatch(/\/orders\?filial_id=7$/);
  expect(JSON.parse(options.body)).toEqual({ client_id: 10, payment_method: 'pix', discount: '5.00', items: [{ product_id: 20, quantity: 2 }] });
  expect(options.body).not.toMatch(/unit_price|occurred_at|client_reference|net_total/);
});

test('rejects money with more than two decimals before sending a sale', async () => {
  render(<OrderForm filialId={7} onClose={jest.fn()} onSaved={jest.fn()} />);
  await fillOrder();
  fireEvent.change(screen.getByLabelText('Desconto (R$)'), { target: { value: '0,005' } });
  submit();
  expect(screen.getByRole('alert')).toHaveTextContent(/duas casas decimais/);
  expect(postCalls()).toHaveLength(0);
});

test('validates summed quantities when the same product is included on two lines', async () => {
  render(<OrderForm filialId={7} onClose={jest.fn()} onSaved={jest.fn()} />);
  await fillOrder();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
  fireEvent.change(screen.getByLabelText('Produto 2'), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Quantidade 2'), { target: { value: '3' } });
  submit();
  expect(screen.getByRole('alert')).toHaveTextContent(/quantidade total.*excede o estoque/i);
  expect(postCalls()).toHaveLength(0);
});

test('allows repeated product lines when their summed quantity fits the stock', async () => {
  const onSaved = jest.fn();
  render(<OrderForm filialId={7} onClose={jest.fn()} onSaved={onSaved} />);
  await fillOrder();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
  fireEvent.change(screen.getByLabelText('Produto 2'), { target: { value: '20' } });
  submit();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(JSON.parse(postCalls()[0][1].body).items).toEqual([{ product_id: 20, quantity: 2 }, { product_id: 20, quantity: 1 }]);
});

test('preserves the draft and explains an inactive-client rejection from the server', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => options.method === 'POST' ? Promise.resolve(response({ detail: 'Cliente desativado não pode comprar.' }, 400)) : baseFetch(url, options));
  render(<OrderForm filialId={7} onClose={jest.fn()} onSaved={jest.fn()} />);
  await fillOrder();
  submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Cliente desativado não pode comprar.');
  expect(screen.getByLabelText('Cliente')).toHaveValue('10');
  expect(screen.getByLabelText('Quantidade 1')).toHaveValue(2);
});

test('guards against duplicate submissions while the sale is being recorded', async () => {
  const baseFetch = fetch;
  let resolveOrder;
  global.fetch = jest.fn((url, options) => options.method === 'POST' ? new Promise((resolve) => { resolveOrder = resolve; }) : baseFetch(url, options));
  const onSaved = jest.fn();
  render(<OrderForm filialId={7} onClose={jest.fn()} onSaved={onSaved} />);
  await fillOrder();
  const form = screen.getByRole('button', { name: 'Registrar venda' }).closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(postCalls()).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Registrando...' })).toBeDisabled();
  await act(async () => resolveOrder(response({ id: 40, total: '50.00' }, 201)));
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('does not permit an order if no active clients are available', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => url.includes('/clients?') ? Promise.resolve(response(page([]))) : baseFetch(url, options));
  render(<OrderForm filialId={7} onClose={jest.fn()} onSaved={jest.fn()} />);
  await screen.findByRole('option', { name: /Produto ativo/ });
  expect(screen.getByRole('button', { name: 'Registrar venda' })).toBeDisabled();
  expect(screen.getByText(/É necessário ter um cliente ativo/)).toBeInTheDocument();
});
