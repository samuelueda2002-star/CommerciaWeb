import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductForm from './ProductForm';
import { clearAccessToken, saveAccessToken } from '../api/client';

const categories = [{ id: 30, name: 'Vestuário' }, { id: 31, name: 'Calçados' }];
const product = {
  id: 20, sku: 'SKU-20', name: 'Camiseta', category_id: 30, status: 'active',
  brand: 'Marca', barcode: '0001234567890', description: 'Algodão', weight: '1.25', height: '2.5', width: null, depth: null,
  price: { price_default: '25.90' }, stock: { quantity: 4 },
};

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) };
}

function mutations() {
  return fetch.mock.calls.filter(([, options]) => ['POST', 'PATCH'].includes(options.method));
}

async function ready() {
  await screen.findByRole('option', { name: 'Vestuário' });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: '  Camiseta  ' } });
  fireEvent.change(screen.getByLabelText(/^SKU/), { target: { value: '  SKU-001  ' } });
  fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: '30' } });
}

function submit(name = 'Salvar produto') {
  fireEvent.submit(screen.getByRole('button', { name }).closest('form'));
}

beforeEach(() => {
  saveAccessToken('product-test-token');
  global.fetch = jest.fn(async (url) => url.includes('/catalog/categories?')
    ? response({ items: categories, total: 2, limit: 200, offset: 0 })
    : response({ id: 20 }, 201));
});

afterEach(() => {
  clearAccessToken();
  jest.restoreAllMocks();
});

test('creates a product in the session branch using real categories and normalized optional data', async () => {
  const onSaved = jest.fn();
  render(<ProductForm filialId={7} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByLabelText(/^Nome/)).toHaveFocus();
  await ready();
  fillRequiredFields();
  fireEvent.change(screen.getByLabelText(/^Peso/), { target: { value: '1,25' } });
  fireEvent.change(screen.getByLabelText(/^Altura/), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText(/^Código de barras/), { target: { value: '0001234567890' } });
  submit();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  const [url, options] = mutations()[0];
  expect(url).toMatch(/\/api\/v1\/catalog\/products\?filial_id=7$/);
  expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer product-test-token');
  expect(options.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(options.body)).toEqual({ name: 'Camiseta', sku: 'SKU-001', category_id: 30, brand: null, barcode: '0001234567890', description: null, weight: 1.25, height: 0, width: null, depth: null });
  expect(fetch.mock.calls[0][0]).toContain('filial_id=7');
});

test('validates required fields, available categories and nonnegative measures before saving', async () => {
  render(<ProductForm filialId={7} initialCategoryId="999" onClose={jest.fn()} onSaved={jest.fn()} />);
  await ready();
  fireEvent.change(screen.getByLabelText(/^Peso/), { target: { value: '-1' } });
  submit();
  expect(screen.getByText('Informe o nome do produto.')).toBeInTheDocument();
  expect(screen.getByText('Informe o SKU do produto.')).toBeInTheDocument();
  expect(screen.getByText('Selecione uma categoria disponível.')).toBeInTheDocument();
  expect(screen.getByText('Informe um número maior ou igual a zero.')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Nome/)).toHaveFocus();
  expect(mutations()).toHaveLength(0);
});

test('prefills an existing product and patches only supported fields without changing its SKU, price or stock', async () => {
  const onSaved = jest.fn();
  render(<ProductForm filialId={7} product={product} onClose={jest.fn()} onSaved={onSaved} />);
  await ready();
  expect(screen.getByRole('dialog', { name: 'Editar produto' })).toBeInTheDocument();
  expect(screen.getByLabelText(/^SKU/)).toHaveValue('SKU-20');
  expect(screen.getByLabelText(/^SKU/)).toHaveAttribute('readonly');
  expect(screen.getByLabelText(/^Categoria/)).toHaveValue('30');
  expect(screen.getByLabelText(/^Peso/)).toHaveValue('1,25');
  expect(screen.getByLabelText(/^Código de barras/)).toHaveValue('0001234567890');
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Camiseta atualizada' } });
  fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: '31' } });
  fireEvent.change(screen.getByLabelText(/^Marca/), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: '' } });
  submit('Salvar alterações');
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  const [url, options] = mutations()[0];
  expect(url).toMatch(/\/catalog\/products\/20$/);
  expect(options.method).toBe('PATCH');
  expect(JSON.parse(options.body)).toEqual({ name: 'Camiseta atualizada', category_id: 31, brand: '', description: '', barcode: '0001234567890', weight: 1.25, height: 2.5 });
});

test('explains when an existing measure cannot be cleared instead of pretending it was removed', async () => {
  render(<ProductForm filialId={7} product={product} onClose={jest.fn()} onSaved={jest.fn()} />);
  await ready();
  fireEvent.change(screen.getByLabelText(/^Peso/), { target: { value: '' } });
  submit('Salvar alterações');
  expect(screen.getByLabelText(/^Peso/)).toHaveAccessibleDescription('Informe uma medida. Para zerar este campo, use 0.');
  expect(mutations()).toHaveLength(0);
});

test('keeps values after an error and retries the same update', async () => {
  const baseFetch = fetch;
  let failed = false;
  global.fetch = jest.fn((url, options) => {
    if (options.method === 'PATCH' && !failed) {
      failed = true;
      return Promise.resolve(response({ detail: 'Código de barras já cadastrado.' }, 409));
    }
    return baseFetch(url, options);
  });
  const onSaved = jest.fn();
  render(<ProductForm filialId={7} product={product} onClose={jest.fn()} onSaved={onSaved} />);
  await ready();
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Nome atualizado' } });
  submit('Salvar alterações');
  expect(await screen.findByRole('alert')).toHaveTextContent('Código de barras já cadastrado.');
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Nome atualizado');
  expect(onSaved).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Código de barras/), { target: { value: '0009876543210' } });
  submit('Salvar alterações');
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(mutations().map(([, options]) => options.method)).toEqual(['PATCH', 'PATCH']);
});

test('allows retrying category loading and blocks saving until categories are available', async () => {
  fetch.mockResolvedValueOnce(response({ detail: 'Unavailable' }, 500));
  render(<ProductForm filialId={7} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Salvar produto' })).toBeDisabled();
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as categorias.');
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar categorias' }));
  await ready();
  expect(screen.getByRole('button', { name: 'Salvar produto' })).toBeEnabled();
  expect(mutations()).toHaveLength(0);
});

test('shows an empty category state and permits canceling without writing data', async () => {
  fetch.mockResolvedValue(response({ items: [], total: 0, limit: 200, offset: 0 }));
  const onClose = jest.fn();
  render(<ProductForm filialId={7} onClose={onClose} onSaved={jest.fn()} />);
  expect(await screen.findByRole('status')).toHaveTextContent('Nenhuma categoria disponível.');
  expect(screen.getByRole('button', { name: 'Salvar produto' })).toBeDisabled();
  submit();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(mutations()).toHaveLength(0);
});

test('blocks duplicate submissions and dismissing while saving, then aborts on unmount', async () => {
  const baseFetch = fetch;
  let signal;
  global.fetch = jest.fn((url, options) => options.method === 'POST' ? new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }) : baseFetch(url, options));
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const view = render(<ProductForm filialId={7} onClose={onClose} onSaved={onSaved} />);
  await ready();
  fillRequiredFields();
  const form = screen.getByRole('button', { name: 'Salvar produto' }).closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(mutations()).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(screen.getByLabelText(/^Nome/)).toBeDisabled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => {});
  expect(signal.aborted).toBe(true);
  expect(onSaved).not.toHaveBeenCalled();
});
