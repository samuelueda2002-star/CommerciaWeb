import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientForm from './ClientForm';
import { clearAccessToken, saveAccessToken } from '../api/client';

function response(payload, status = 201) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) };
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: '  Ana  ' } });
  fireEvent.change(screen.getByLabelText(/^Sobrenome/), { target: { value: '  Silva  ' } });
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: '123.456.789-09' } });
}

function submit() {
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar cliente' }).closest('form'));
}

const existingClient = { id: 42, first_name: 'Mariana', last_name: 'Costa', email: 'mariana@example.com', cpf: '12345678909', phone: '(11) 98888-7777', birth_date: '1990-06-15', status: 'active', filial_id: 7 };

beforeEach(() => {
  saveAccessToken('client-test-token');
  global.fetch = jest.fn().mockResolvedValue(response({ id: 11 }));
});

afterEach(() => {
  clearAccessToken();
  jest.restoreAllMocks();
});

test('focuses the name and validates required fields, email and CPF before sending', () => {
  render(<ClientForm filialId={7} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.getByLabelText(/^Nome/)).toHaveFocus();
  submit();
  expect(screen.getByText('Informe o nome do cliente.')).toBeInTheDocument();
  expect(screen.getByText('Informe o sobrenome do cliente.')).toBeInTheDocument();
  expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
  expect(screen.getByText('Informe um CPF com 11 dígitos.')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  fillRequiredFields();
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'email-invalido' } });
  fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: '123' } });
  submit();
  expect(screen.getByLabelText(/^E-mail/)).toHaveFocus();
  expect(screen.getByLabelText(/^E-mail/)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText(/^CPF/)).toHaveAccessibleDescription('Informe um CPF com 11 dígitos.');
  expect(fetch).not.toHaveBeenCalled();
});

test('sends authenticated JSON with the branch and optional values', async () => {
  const onSaved = jest.fn();
  render(<ClientForm filialId={7} onClose={jest.fn()} onSaved={onSaved} />);
  fillRequiredFields();
  fireEvent.change(screen.getByLabelText(/^Telefone/), { target: { value: '(11) 99999-9999' } });
  fireEvent.change(screen.getByLabelText(/^Data de nascimento/), { target: { value: '1995-04-12' } });
  submit();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  const [url, options] = fetch.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/clients\?filial_id=7$/);
  expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer client-test-token');
  expect(options.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(options.body)).toEqual({ first_name: 'Ana', last_name: 'Silva', email: 'ana@example.com', cpf: '12345678909', phone: '(11) 99999-9999', birth_date: '1995-04-12' });
});

test('prefills an existing client and updates its ID with normalized values and cleared optional fields', async () => {
  const onSaved = jest.fn();
  render(<ClientForm filialId={7} client={existingClient} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByRole('dialog', { name: 'Editar cliente' })).toBeInTheDocument();
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Mariana');
  expect(screen.getByLabelText(/^Sobrenome/)).toHaveValue('Costa');
  expect(screen.getByLabelText(/^E-mail/)).toHaveValue('mariana@example.com');
  expect(screen.getByLabelText(/^CPF/)).toHaveValue('123.456.789-09');
  expect(screen.getByLabelText(/^Telefone/)).toHaveValue('(11) 98888-7777');
  expect(screen.getByLabelText(/^Data de nascimento/)).toHaveValue('1990-06-15');
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: '  Marina  ' } });
  fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: '98765432100' } });
  fireEvent.change(screen.getByLabelText(/^Telefone/), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText(/^Data de nascimento/), { target: { value: '' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar alterações' }).closest('form'));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/clients\/42$/);
  expect(options.method).toBe('PATCH');
  expect(options.headers.Authorization).toBe('Bearer client-test-token');
  expect(options.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(options.body)).toEqual({ first_name: 'Marina', last_name: 'Costa', email: 'mariana@example.com', cpf: '98765432100', phone: null, birth_date: null });
});

test('keeps edits after a failed update and allows retry without creating another client', async () => {
  fetch.mockResolvedValueOnce(response({ detail: 'CPF já cadastrado.' }, 409));
  const onSaved = jest.fn();
  render(<ClientForm filialId={7} client={existingClient} onClose={jest.fn()} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Marina' } });
  const form = screen.getByRole('button', { name: 'Salvar alterações' }).closest('form');
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('CPF já cadastrado.');
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Marina');
  expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: '98765432100' } });
  fireEvent.submit(form);
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(fetch.mock.calls.map(([, options]) => options.method)).toEqual(['PATCH', 'PATCH']);
});

test('preserves values after an API error and permits retry with empty optional fields', async () => {
  fetch.mockResolvedValueOnce(response({ detail: 'CPF já cadastrado.' }, 409));
  const onSaved = jest.fn();
  render(<ClientForm filialId={7} onClose={jest.fn()} onSaved={onSaved} />);
  fillRequiredFields();
  submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('CPF já cadastrado.');
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/^E-mail/)).toHaveValue('ana@example.com');
  expect(screen.getByLabelText(/^CPF/)).toHaveValue('123.456.789-09');
  fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: '98765432100' } });
  submit();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ cpf: '98765432100', phone: null, birth_date: null });
});

test('prevents duplicate submissions and dismissing the form while saving', async () => {
  let finish;
  fetch.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const onClose = jest.fn();
  const onSaved = jest.fn();
  render(<ClientForm filialId={7} onClose={onClose} onSaved={onSaved} />);
  fillRequiredFields();
  const form = screen.getByRole('button', { name: 'Salvar cliente' }).closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Fechar cadastro' })).toBeDisabled();
  expect(screen.getByLabelText(/^Nome/)).toBeDisabled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { finish(response({ id: 11 })); });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('cancels without sending data and aborts an in-flight request on unmount', async () => {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const view = render(<ClientForm filialId={7} onClose={onClose} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockImplementation((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  fillRequiredFields();
  submit();
  const signal = fetch.mock.calls[0][1].signal;
  view.unmount();
  await act(async () => {});
  expect(signal.aborted).toBe(true);
  expect(onSaved).not.toHaveBeenCalled();
});
