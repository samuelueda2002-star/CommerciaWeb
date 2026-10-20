const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
const TOKEN_KEY = 'commercia.access_token';
export const SESSION_EXPIRED_EVENT = 'commercia:session-expired';
let memoryToken = null;

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function readStorage(storageName) {
  try {
    return window[storageName].getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return memoryToken || readStorage('sessionStorage') || readStorage('localStorage');
}

export function clearAccessToken() {
  memoryToken = null;
  ['sessionStorage', 'localStorage'].forEach((storageName) => {
    try {
      window[storageName].removeItem(TOKEN_KEY);
    } catch {
      // Browsers may disable storage; the in-memory session still works.
    }
  });
}

export function saveAccessToken(token, remember = false) {
  clearAccessToken();
  memoryToken = token;
  try {
    window[remember ? 'localStorage' : 'sessionStorage'].setItem(TOKEN_KEY, token);
  } catch {
    // Keep the session in memory when persistent storage is unavailable.
  }
}

function errorMessage(status, payload) {
  if (status === 401) return 'Sessão expirada ou credenciais inválidas. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para acessar os dados desta filial.';
  if (status >= 500) return 'A API está indisponível no momento. Tente novamente.';
  const detail = payload?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join('; ') || 'Dados inválidos para a API.';
  }
  return payload?.message || `Não foi possível concluir a solicitação (${status}).`;
}

export async function request(path, { query, token = getAccessToken(), signal, ...options } = {}) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const search = params.toString();
  const url = `${API_BASE_URL}${path}${search ? `?${search}` : ''}`;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (response.ok) throw new ApiError('A API retornou uma resposta inválida. Confira a URL configurada.', response.status);
      }
    }
    if (!response.ok) {
      if (response.status === 401 && token && token === getAccessToken()) {
        clearAccessToken();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      if (response.status === 404 && path.startsWith('/dashboard/')) {
        throw new ApiError('Os indicadores e relatórios ainda não estão disponíveis neste servidor.', 404, payload);
      }
      throw new ApiError(errorMessage(response.status, payload), response.status, payload);
    }
    return payload;
  } catch (error) {
    if (timedOut) throw new ApiError('A API demorou para responder. Tente novamente.');
    if (error.name === 'AbortError' || error instanceof ApiError) throw error;
    throw new ApiError('Não foi possível conectar à API. Verifique a conexão e o endereço do servidor.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
