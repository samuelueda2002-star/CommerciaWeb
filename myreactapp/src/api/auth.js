import { ApiError, request } from './client';

export async function login(username, password, signal) {
  const body = new URLSearchParams();
  body.set('username', username);
  body.set('password', password);
  const result = await request('/auth/login', { method: 'POST', body, token: null, signal });
  if (!result?.access_token) throw new ApiError('A API não retornou o token de acesso.');
  return result.access_token;
}

export async function getCurrentUser(token, signal) {
  const result = await request('/auth/me', { token, signal });
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ApiError('A API retornou uma conta inválida.');
  const { id, username, full_name, email, is_superuser, accessible_filial_ids } = result;
  return { id, username, full_name, email, is_superuser, accessible_filial_ids };
}

export function getFilialId(user) {
  const filialId = user?.accessible_filial_ids?.[0];
  if (filialId === undefined || filialId === null) {
    throw new ApiError('Sua conta não possui uma filial acessível. Contate o administrador.', 403);
  }
  return filialId;
}
