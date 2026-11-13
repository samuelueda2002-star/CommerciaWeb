import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserForm from './UserForm';
import { clearAccessToken, getAccessToken, saveAccessToken } from '../api/client';

const groups = [{ id: 1, name: 'Administrador' }, { id: 2, name: 'Vendedor' }];
const companies = [
  { id: 7, fantasy_name: 'Loja Centro', corporate_name: 'Empresa Centro', filial_code: 'CENTRO' },
  { id: 8, fantasy_name: null, corporate_name: 'Loja Norte', filial_code: 'NORTE' },
  { id: 99, fantasy_name: 'Loja sem acesso', filial_code: 'OUTRA' },
];
const user = { id: 50, full_name: 'Ana Silva', username: 'ana.silva', email: 'ana@example.com', is_active: true, groups: [{ id: 2, name: 'Vendedor' }] };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });
const mutations = () => fetch.mock.calls.filter(([, options]) => options.method === 'POST');

function renderForm(props = {}) {
  return render(<UserForm filialId={7} accessibleFilialIds={[7, 8]} onClose={jest.fn()} onSaved={jest.fn()} {...props} />);
}

async function fill() {
  await screen.findByRole('checkbox', { name: 'Vendedor' });
  fireEvent.change(screen.getByLabelText(/^Nome completo/), { target: { value: '  Ana Silva  ' } });
  fireEvent.change(screen.getByLabelText(/^Login/), { target: { value: '  ana.silva  ' } });
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: '  ana@example.com  ' } });
  fireEvent.change(screen.getByLabelText(/^Senha inicial/), { target: { value: ' secure-pass ' } });
  fireEvent.change(screen.getByLabelText(/^Confirmar senha/), { target: { value: ' secure-pass ' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Vendedor' }));
}

function submit() {
  fireEvent.submit(screen.getByRole('button', { name: 'Cadastrar usuário' }).closest('form'));
}

beforeEach(() => {
  saveAccessToken('user-test-token');
  global.fetch = jest.fn(async (url) => {
    if (url.endsWith('/users/groups')) return response(groups);
    if (url.endsWith('/companies')) return response(companies);
    return response(user, 201);
  });
});

afterEach(() => {
  clearAccessToken();
  jest.restoreAllMocks();
});

test('creates a user through the API with selected groups and branches, preserving the password exactly', async () => {
  const onSaved = jest.fn();
  renderForm({ onSaved });
  expect(screen.getByLabelText(/^Nome completo/)).toHaveFocus();
  await fill();
  expect(screen.getByRole('checkbox', { name: 'Loja Centro · CENTRO' })).toBeChecked();
  expect(screen.queryByText(/Loja sem acesso/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Loja Norte · NORTE' }));
  submit();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  const [url, options] = mutations()[0];
  expect(url).toMatch(/\/api\/v1\/users$/);
  expect(options.headers.Authorization).toBe('Bearer user-test-token');
  expect(options.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(options.body)).toEqual({ full_name: 'Ana Silva', username: 'ana.silva', email: 'ana@example.com', password: ' secure-pass ', group_ids: [2], filial_ids: [7, 8] });
  expect(options.body).not.toMatch(/confirm_password|password_hash|is_superuser/);
  expect(window.localStorage.getItem('password')).toBeNull();
});

test('validates required fields and at least one profile and branch before submitting', async () => {
  renderForm();
  await screen.findByRole('checkbox', { name: 'Vendedor' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Loja Centro · CENTRO' }));
  submit();
  expect(screen.getByText('Informe um nome com até 120 caracteres.')).toBeInTheDocument();
  expect(screen.getByText('Use de 3 a 60 letras, números, pontos, hífens ou sublinhados.')).toBeInTheDocument();
  expect(screen.getByText('Selecione pelo menos um perfil disponível.')).toBeInTheDocument();
  expect(screen.getByText('Selecione pelo menos uma filial disponível.')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Nome completo/)).toHaveFocus();
  expect(mutations()).toHaveLength(0);
});

test.each([
  ['username', /^Login/, 'a b', /3 a 60/],
  ['email', /^E-mail/, 'invalid', /e-mail válido/],
  ['password', /^Senha inicial/, '12345', /6 a 72/],
  ['confirmation', /^Confirmar senha/, 'different', /senhas devem ser iguais/],
])('validates %s against the account contract', async (name, label, value, message) => {
  renderForm();
  await fill();
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  submit();
  expect(screen.getByText(message)).toBeInTheDocument();
  expect(mutations()).toHaveLength(0);
});

test('preserves the draft after duplicate-user errors and permits retry', async () => {
  const baseFetch = fetch;
  let rejected = false;
  global.fetch = jest.fn((url, options) => {
    if (options.method === 'POST' && !rejected) { rejected = true; return Promise.resolve(response({ detail: 'Nome de usuário já cadastrado.' }, 409)); }
    return baseFetch(url, options);
  });
  const onSaved = jest.fn();
  renderForm({ onSaved });
  await fill();
  submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Nome de usuário já cadastrado.');
  expect(screen.getByLabelText(/^Login/)).toHaveValue('  ana.silva  ');
  expect(screen.getByLabelText(/^Senha inicial/)).toHaveValue(' secure-pass ');
  submit();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(mutations()).toHaveLength(2);
});

test('reports a forbidden account creation without closing the form or clearing the session', async () => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => options.method === 'POST' ? Promise.resolve(response({ detail: 'Você não tem permissão para cadastrar usuários.' }, 403)) : baseFetch(url, options));
  const onSaved = jest.fn();
  renderForm({ onSaved });
  await fill();
  submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para cadastrar usuários.');
  expect(onSaved).not.toHaveBeenCalled();
  expect(getAccessToken()).toBe('user-test-token');
});

test('retries loading profiles and branches after a failure', async () => {
  fetch.mockResolvedValueOnce(response({ detail: 'Unavailable' }, 500));
  renderForm();
  expect(screen.getByRole('button', { name: 'Cadastrar usuário' })).toBeDisabled();
  expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível carregar/);
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar opções' }));
  await screen.findByRole('checkbox', { name: 'Vendedor' });
  expect(screen.getByRole('button', { name: 'Cadastrar usuário' })).toBeEnabled();
});

test.each(['groups', 'filials'])('disables creation when there are no accessible %s', async (kind) => {
  const baseFetch = fetch;
  global.fetch = jest.fn((url, options) => (kind === 'groups' && url.endsWith('/users/groups')) || (kind === 'filials' && url.endsWith('/companies')) ? Promise.resolve(response([])) : baseFetch(url, options));
  renderForm();
  expect(await screen.findByText(/É necessário ter pelo menos um perfil/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cadastrar usuário' })).toBeDisabled();
  expect(mutations()).toHaveLength(0);
});

test('cancel and Escape close the form without creating an account', async () => {
  const onClose = jest.fn();
  renderForm({ onClose });
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(mutations()).toHaveLength(0);
});

test('prevents duplicate submissions and closing during creation and aborts on unmount', async () => {
  const baseFetch = fetch;
  let signal;
  global.fetch = jest.fn((url, options) => options.method === 'POST' ? new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }) : baseFetch(url, options));
  const onClose = jest.fn();
  const view = renderForm({ onClose });
  await fill();
  const form = screen.getByRole('button', { name: 'Cadastrar usuário' }).closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(mutations()).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Cadastrando...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => view.unmount());
  expect(signal.aborted).toBe(true);
});
