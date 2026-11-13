import { ApiError, request } from './client';
import { reportsApi } from './dashboard';

export async function listAll(path, filialId, signal) {
  const items = [];
  let offset = 0;
  while (true) {
    const page = await request(path, { query: { filial_id: filialId, limit: 200, offset }, signal });
    if (!Array.isArray(page?.items) || !Number.isInteger(page.total)) {
      throw new ApiError('A API retornou uma listagem inválida.');
    }
    items.push(...page.items);
    if (items.length >= page.total) return items;
    if (!page.items.length) throw new ApiError('Não foi possível carregar a listagem completa. Tente novamente.');
    offset += page.items.length;
  }
}

export const listProducts = (filialId, signal) => listAll('/catalog/products', filialId, signal);
export const listCategories = (filialId, signal) => listAll('/catalog/categories', filialId, signal);
const listClients = (filialId, signal) => listAll('/clients', filialId, signal);

function safeUser({ id, username, full_name, email, is_superuser, is_active, last_login, groups }) {
  // Authentication secrets returned by the current server never enter UI state.
  return { id, username, full_name, email, is_superuser, is_active, last_login, groups };
}

export async function listUsers(signal) {
  const users = await listAll('/users', undefined, signal);
  return users.map(safeUser);
}

export async function getUserCreationOptions(accessibleFilialIds, signal) {
  const [groups, companies] = await Promise.all([
    request('/users/groups', { signal }), request('/companies', { signal }),
  ]);
  if (!Array.isArray(groups) || !Array.isArray(companies)) throw new ApiError('A API retornou perfis ou filiais inválidos.');
  const allowed = new Set(accessibleFilialIds);
  return {
    groups: groups.map(({ id, name }) => ({ id, name })),
    filials: companies.filter((company) => allowed.has(company.id)).map((company) => ({
      id: company.id, name: company.fantasy_name || company.corporate_name, code: company.filial_code,
    })),
  };
}

export async function createUser(user, signal) {
  const { full_name, username, email, password, group_ids, filial_ids } = user;
  const result = await request('/users', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, username, email, password, group_ids, filial_ids }), signal,
  });
  return safeUser(result);
}

export async function getOrderOptions(filialId, signal) {
  const [products, clients] = await Promise.all([listProducts(filialId, signal), listClients(filialId, signal)]);
  return { products: await enrichProducts(products.filter((product) => product.status === 'active'), signal), clients: clients.filter((client) => client.status === 'active') };
}

export function createOrder(filialId, order, signal) {
  // Whitelist the online contract. Prices, totals and offline-only fields never leave the browser.
  const { client_id, payment_method, discount, items } = order;
  return request('/orders', {
    method: 'POST', query: { filial_id: filialId }, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id, payment_method, discount, items: items.map(({ product_id, quantity }) => ({ product_id, quantity })) }), signal,
  });
}

export function getOrder(orderId, signal) {
  return request(`/orders/${orderId}`, { signal });
}

async function optionalResource(path, signal) {
  try {
    return await request(path, { signal });
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function enrichProducts(products, signal) {
  const result = new Array(products.length);
  let cursor = 0;
  // Bound concurrency: each product has separate price and stock endpoints.
  await Promise.all(Array.from({ length: Math.min(4, products.length) }, async () => {
    while (cursor < products.length && !signal?.aborted) {
      const index = cursor++;
      const product = products[index];
      const [price, stock] = await Promise.all([
        optionalResource(`/catalog/products/${product.id}/prices/current`, signal),
        optionalResource(`/catalog/products/${product.id}/stock`, signal),
      ]);
      result[index] = { ...product, price, stock };
    }
  }));
  return result;
}

export async function getProducts(filialId, signal) {
  const [products, categories] = await Promise.all([listProducts(filialId, signal), listCategories(filialId, signal)]);
  return { products: await enrichProducts(products, signal), categories };
}

export function createProduct(filialId, product, signal) {
  return request('/catalog/products', {
    method: 'POST',
    query: { filial_id: filialId },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
    signal,
  });
}

export function updateProduct(productId, product, signal) {
  return request(`/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
    signal,
  });
}

export function deleteProduct(productId, signal) {
  return request(`/catalog/products/${productId}`, { method: 'DELETE', signal });
}

export async function getClients(filialId, signal) {
  const [clients, sales] = await Promise.all([listClients(filialId, signal), listAll('/dashboard/reports/sales-by-client', filialId, signal)]);
  return { clients, purchaseCounts: Object.fromEntries(sales.map((item) => [item.client_id, item.total_orders])) };
}

export function createClient(filialId, client, signal) {
  return request('/clients', {
    method: 'POST',
    query: { filial_id: filialId },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(client),
    signal,
  });
}

export function updateClient(clientId, client, signal) {
  return request(`/clients/${clientId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(client),
    signal,
  });
}

export function deleteClient(clientId, signal) {
  return request(`/clients/${clientId}`, { method: 'DELETE', signal });
}

export async function getCategories(filialId, signal) {
  const [categories, products] = await Promise.all([listCategories(filialId, signal), listProducts(filialId, signal)]);
  return { categories, products };
}

export async function getDepartments(signal) {
  const departments = await request('/catalog/departments', { signal });
  if (!Array.isArray(departments)) throw new ApiError('A API retornou uma lista de departamentos inválida.');
  return departments;
}

export function createCategory(filialId, category, signal) {
  return request('/catalog/categories', {
    method: 'POST',
    query: { filial_id: filialId },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(category),
    signal,
  });
}

export function updateCategory(categoryId, category, signal) {
  return request(`/catalog/categories/${categoryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(category),
    signal,
  });
}

export async function getSales(filialId, signal, { offset = 0, status = '', dates = {} } = {}) {
  const [page, clients, summary, statuses, byClient] = await Promise.all([
    request('/orders', { query: { filial_id: filialId, limit: 50, offset, status }, signal }),
    listClients(filialId, signal),
    reportsApi.salesSummary(filialId, dates, signal),
    reportsApi.salesByStatus(filialId, { ...dates, limit: 200 }, signal),
    reportsApi.salesByClient(filialId, { ...dates, limit: 1 }, signal),
  ]);
  if (!Array.isArray(page?.items) || !Number.isInteger(page.total)) throw new ApiError('A API retornou uma listagem de vendas inválida.');
  return { orders: page.items, total: page.total, clients, metrics: {
    revenue: summary.total_revenue,
    orders: summary.total_orders + summary.cancelled_orders,
    pending: statuses.items?.find((item) => item.status === 'pending')?.count ?? 0,
    clients: byClient.total,
  } };
}
