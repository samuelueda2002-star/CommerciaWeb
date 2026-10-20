import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientDeleteDialog from './ClientDeleteDialog';
import { clearAccessToken, saveAccessToken } from '../api/client';

const client = { id: 10, first_name: 'Mariana', last_name: 'Costa', email: 'mariana@example.com', status: 'active' };

beforeEach(() => {
  saveAccessToken('client-delete-test-token');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ...client, status: 'inactive' }) });
});

afterEach(() => {
  clearAccessToken();
  jest.restoreAllMocks();
});

test('identifies the selected client and explains deactivation; cancel does not send data', () => {
  const onClose = jest.fn();
  render(<ClientDeleteDialog client={client} onClose={onClose} onDeleted={jest.fn()} />);
  const dialog = screen.getByRole('alertdialog', { name: 'Excluir cliente?' });
  expect(dialog).toHaveAccessibleDescription(/Mariana Costa.*mariana@example.com.*cliente ficará inativo.*histórico de pedidos serão preservados/);
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});

test('confirms deletion using the selected client endpoint and session token', async () => {
  const onDeleted = jest.fn();
  render(<ClientDeleteDialog client={client} onClose={jest.fn()} onDeleted={onDeleted} />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/clients\/10$/);
  expect(options.method).toBe('DELETE');
  expect(options.headers.Authorization).toBe('Bearer client-delete-test-token');
  expect(options.body).toBeUndefined();
});
