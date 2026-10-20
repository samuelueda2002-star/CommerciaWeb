import { ApiError, request } from './client';

export async function login(username, password, signal) {
  const body = new URLSearchParams();
  body.set('username', username);
  body.set('password', password);
  const result = await request('/auth/login', { method: 'POST', body, token: null, signal });
  if (!result?.access_token) throw new ApiError('A API não retornou o token de acesso.');
  return result.access_token;
}

export function getCurrentUser(token, signal) {
  return request('/auth/me', { token, signal });
}

export function getFilialId(user) {
  const filialId = user?.accessible_filial_ids?.[0];
  if (filialId === undefined || filialId === null) {
    throw new ApiError('Sua conta não possui uma filial acessível. Contate o administrador.', 403);
  }
  return filialId;
}
