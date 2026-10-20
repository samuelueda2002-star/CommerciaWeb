import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductDeleteDialog from './ProductDeleteDialog';
import { clearAccessToken, saveAccessToken } from '../api/client';

const product = { id: 20, name: 'Camiseta API', sku: 'SKU-20', status: 'active' };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });

beforeEach(() => {
  saveAccessToken('delete-test-token');
  global.fetch = jest.fn().mockResolvedValue(response({ ...product, status: 'inactive' }));
});

afterEach(() => {
  clearAccessToken();
  jest.restoreAllMocks();
});

test('warns with the selected product and focuses cancel; cancel, close and Escape do not delete', () => {
  const onClose = jest.fn();
  render(<ProductDeleteDialog product={product} onClose={onClose} onDeleted={jest.fn()} />);
  const dialog = screen.getByRole('alertdialog', { name: 'Excluir produto?' });
  expect(dialog).toHaveAccessibleDescription(/Camiseta API.*SKU-20.*produto ficará inativo.*histórico de vendas serão preservados/);
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso de exclusão' }));
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(3);
  expect(fetch).not.toHaveBeenCalled();
});

test('sends one authenticated DELETE only after confirmation and blocks duplicate submissions', async () => {
  let finish;
  fetch.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const onClose = jest.fn();
  const onDeleted = jest.fn();
  render(<ProductDeleteDialog product={product} onClose={onClose} onDeleted={onDeleted} />);
  const form = screen.getByRole('button', { name: 'Confirmar exclusão' }).closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/catalog\/products\/20$/);
  expect(options.method).toBe('DELETE');
  expect(options.headers.Authorization).toBe('Bearer delete-test-token');
  expect(options.body).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Fechar aviso de exclusão' })).toBeDisabled();
  fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
  expect(onDeleted).not.toHaveBeenCalled();
  await act(async () => { finish(response({ ...product, status: 'inactive' })); });
  expect(onDeleted).toHaveBeenCalledTimes(1);
});

test('keeps the warning open on failure and allows retrying the selected product', async () => {
  fetch.mockResolvedValueOnce(response({ detail: 'Unavailable' }, 500));
  const onDeleted = jest.fn();
  render(<ProductDeleteDialog product={product} onClose={jest.fn()} onDeleted={onDeleted} />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A API está indisponível');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeEnabled();
  expect(onDeleted).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  expect(fetch.mock.calls.map(([url, options]) => [url.match(/\/products\/\d+$/)[0], options.method])).toEqual([
    ['/products/20', 'DELETE'], ['/products/20', 'DELETE'],
  ]);
});

test('aborts a pending request when leaving the dialog without reporting success', async () => {
  let signal;
  fetch.mockImplementation((url, options) => new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const onDeleted = jest.fn();
  const view = render(<ProductDeleteDialog product={product} onClose={jest.fn()} onDeleted={onDeleted} />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  view.unmount();
  await act(async () => {});
  expect(signal.aborted).toBe(true);
  expect(onDeleted).not.toHaveBeenCalled();
});
