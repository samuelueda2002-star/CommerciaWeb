import { ApiError, request } from './client';

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

const listProducts = (filialId, signal) => listAll('/catalog/products', filialId, signal);
export const listCategories = (filialId, signal) => listAll('/catalog/categories', filialId, signal);
const listClients = (filialId, signal) => listAll('/clients', filialId, signal);
const listOrders = (filialId, signal) => listAll('/orders', filialId, signal);

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
  const [clients, orders] = await Promise.all([listClients(filialId, signal), listOrders(filialId, signal)]);
  return { clients, orders };
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

export async function getSales(filialId, signal) {
  const [orders, clients] = await Promise.all([listOrders(filialId, signal), listClients(filialId, signal)]);
  return { orders, clients };
}
