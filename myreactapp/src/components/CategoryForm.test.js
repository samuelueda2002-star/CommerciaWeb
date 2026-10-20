import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CategoryForm from './CategoryForm';
import { clearAccessToken, saveAccessToken } from '../api/client';

const departments = [{ id: 5, name: 'Moda' }, { id: 6, name: 'Casa' }];
const category = { id: 30, name: 'Vestuário', department_id: 5, company_id: 2 };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });
const mutations = () => fetch.mock.calls.filter(([, options]) => ['POST', 'PATCH'].includes(options.method));

async function ready() {
  await screen.findByRole('option', { name: 'Moda' });
}

function fill() {
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: '  Acessórios  ' } });
  fireEvent.change(screen.getByLabelText(/^Departamento/), { target: { value: '5' } });
}

function submit(label = 'Salvar categoria') {
  fireEvent.submit(screen.getByRole('button', { name: label }).closest('form'));
}

beforeEach(() => {
  saveAccessToken('category-test-token');
  global.fetch = jest.fn(async (url) => url.endsWith('/catalog/departments') ? response(departments) : response(category, 201));
});

afterEach(() => {
  clearAccessToken();
  jest.restoreAllMocks();
});

test('creates a category using its department, branch and session token', async () => {
  const onSaved = jest.fn();
  render(<CategoryForm filialId={7} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByLabelText(/^Nome/)).toHaveFocus();
  await ready();
  fill();
  submit();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  const [url, options] = mutations()[0];
  expect(url).toMatch(/\/api\/v1\/catalog\/categories\?filial_id=7$/);
  expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer category-test-token');
  expect(options.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(options.body)).toEqual({ name: 'Acessórios', department_id: 5 });
});

test('prefills a category, preserves edits after a failure and retries the selected ID', async () => {
  const baseFetch = fetch;
  let failed = false;
  global.fetch = jest.fn((url, options) => {
    if (options.method === 'PATCH' && !failed) {
      failed = true;
      return Promise.resolve(response({ detail: 'Categoria já cadastrada.' }, 409));
    }
    return baseFetch(url, options);
  });
  const onSaved = jest.fn();
  render(<CategoryForm filialId={7} category={category} onClose={jest.fn()} onSaved={onSaved} />);
  await ready();
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Vestuário');
  expect(screen.getByLabelText(/^Departamento/)).toHaveValue('5');
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Nome atualizado' } });
  fireEvent.change(screen.getByLabelText(/^Departamento/), { target: { value: '6' } });
  submit('Salvar alterações');
  expect(await screen.findByRole('alert')).toHaveTextContent('Categoria já cadastrada.');
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/^Nome/)).toHaveValue('Nome atualizado');
  expect(screen.getByLabelText(/^Departamento/)).toHaveValue('6');
  submit('Salvar alterações');
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(mutations()).toHaveLength(2);
  mutations().forEach(([url, options]) => {
    expect(url).toMatch(/\/catalog\/categories\/30$/);
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ name: 'Nome atualizado', department_id: 6 });
  });
});

test('validates the name and available department without writing invalid data', async () => {
  render(<CategoryForm filialId={7} onClose={jest.fn()} onSaved={jest.fn()} />);
  await ready();
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: '   ' } });
  submit();
  expect(screen.getByText('Informe o nome da categoria.')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Departamento/)).toHaveAccessibleDescription('Selecione um departamento disponível.');
  expect(screen.getByLabelText(/^Nome/)).toHaveFocus();
  expect(mutations()).toHaveLength(0);
});

test.each([['server error', response({ detail: 'Unavailable' }, 500)], ['invalid response', response({ items: departments })]])('retries department loading after %s', async (label, failedResponse) => {
  fetch.mockResolvedValueOnce(failedResponse);
  render(<CategoryForm filialId={7} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Salvar categoria' })).toBeDisabled();
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os departamentos.');
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar departamentos' }));
  await ready();
  expect(screen.getByRole('button', { name: 'Salvar categoria' })).toBeEnabled();
  expect(mutations()).toHaveLength(0);
});

test('explains an empty department list and permits cancellation without saving', async () => {
  fetch.mockResolvedValue(response([]));
  const onClose = jest.fn();
  render(<CategoryForm filialId={7} onClose={onClose} onSaved={jest.fn()} />);
  expect(await screen.findByRole('status')).toHaveTextContent('Nenhum departamento disponível.');
  expect(screen.getByRole('button', { name: 'Salvar categoria' })).toBeDisabled();
  submit();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(mutations()).toHaveLength(0);
});

test('blocks duplicate submissions and dismissing while saving and aborts when unmounted', async () => {
  const baseFetch = fetch;
  let signal;
  global.fetch = jest.fn((url, options) => options.method === 'POST' ? new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }) : baseFetch(url, options));
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const view = render(<CategoryForm filialId={7} onClose={onClose} onSaved={onSaved} />);
  await ready();
  fill();
  const form = screen.getByRole('button', { name: 'Salvar categoria' }).closest('form');
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
