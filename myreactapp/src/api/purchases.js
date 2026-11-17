import { ApiError, request } from './client';

function checkPage(page) {
  if (!Array.isArray(page?.items) || !Number.isInteger(page.total) || page.total < 0) {
    throw new ApiError('A API retornou uma listagem de compras inválida.');
  }
  return page;
}

export async function listPurchases(filialId, filters = {}, signal) {
  const query = { filial_id: filialId, limit: 50, offset: filters.offset ?? 0 };
  ['status', 'supplier_id', 'start_date', 'end_date'].forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== '') query[key] = filters[key];
  });
  return checkPage(await request('/purchases', { query, signal }));
}

export function getPurchase(purchaseId, signal) {
  return request(`/purchases/${purchaseId}`, { signal });
}

export async function receivePurchase(purchaseId, signal) {
  const result = await request(`/purchases/${purchaseId}/receive`, { method: 'POST', signal });
  if (result?.id !== purchaseId || result?.status !== 'received') {
    throw new ApiError('O servidor não confirmou o recebimento. Atualize a compra antes de tentar novamente.');
  }
  return result;
}

export async function listSuppliers(filialId, signal) {
  const suppliers = [];
  while (true) {
    const page = await request('/people', {
      query: { filial_id: filialId, role: 'supplier', limit: 200, offset: suppliers.length },
      signal,
    });
    if (!Array.isArray(page?.items) || !Number.isInteger(page.total) || page.total < 0) {
      throw new ApiError('A API retornou uma lista de fornecedores inválida.');
    }
    suppliers.push(...page.items.map(({ id, display_name }) => ({ id, name: display_name })));
    if (suppliers.length >= page.total) return suppliers;
    if (!page.items.length) throw new ApiError('Não foi possível carregar todos os fornecedores.');
  }
}

export async function getPurchaseProductNames(productIds, signal) {
  const ids = [...new Set(productIds)];
  const names = {};
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
    while (cursor < ids.length && !signal?.aborted) {
      const id = ids[cursor++];
      const product = await request(`/catalog/products/${id}`, { signal });
      names[id] = product.name;
    }
  }));
  return names;
}
