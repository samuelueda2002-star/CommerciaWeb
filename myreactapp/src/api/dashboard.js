import { ApiError, request } from './client';

const reportPaths = {
  salesSummary: 'sales-summary',
  salesByClient: 'sales-by-client',
  salesByStatus: 'sales-by-status',
  salesByCategory: 'sales-by-category',
  topProducts: 'top-products',
  salesComparison: 'sales-comparison',
  salesByHour: 'sales-by-hour',
  salesByWeekday: 'sales-by-weekday',
  salesBySeller: 'sales-by-seller',
  salesByFilial: 'sales-by-filial',
  marginSummary: 'margin-summary',
  marginByProduct: 'margin-by-product',
  lowStock: 'low-stock',
  staleProducts: 'stale-products',
  newClientsTrend: 'new-clients-trend',
  inactiveClients: 'inactive-clients',
};

const paginatedReports = new Set(['salesByClient', 'salesByStatus', 'salesByCategory', 'topProducts', 'salesBySeller', 'salesByFilial', 'marginByProduct', 'lowStock', 'staleProducts', 'inactiveClients']);

export function getIndicators(filialId, signal) {
  return request('/dashboard/indicators', { query: { filial_id: filialId }, signal });
}

export const reportsApi = Object.fromEntries(Object.entries(reportPaths).map(([name, path]) => [
  name,
  (filialId, filters = {}, signal) => {
    const query = {};
    const allowed = ['lowStock', 'staleProducts', 'inactiveClients', 'newClientsTrend'].includes(name) ? [] : ['start_date', 'end_date'];
    if (paginatedReports.has(name)) allowed.push('limit', 'offset');
    if (name === 'topProducts') allowed.push('sort_by');
    if (name === 'lowStock') allowed.push('threshold');
    if (['staleProducts', 'inactiveClients', 'newClientsTrend'].includes(name)) allowed.push('days');
    allowed.forEach((key) => { if (filters[key] !== undefined) query[key] = filters[key]; });
    if (name !== 'salesByFilial') query.filial_id = filialId;
    return request(`/dashboard/reports/${path}`, { query, signal });
  },
]));

export async function getPerformance(filialId, filters, signal) {
  const [summary, comparison, categories, weekdays] = await Promise.all([
    reportsApi.salesSummary(filialId, filters, signal),
    reportsApi.salesComparison(filialId, filters, signal),
    reportsApi.salesByCategory(filialId, filters, signal),
    reportsApi.salesByWeekday(filialId, filters, signal),
  ]);
  return { summary, comparison, categories: categories.items, weekdays };
}

export async function getAllReports(filialId, filters, signal) {
  const results = await Promise.all(Object.keys(reportPaths).map(async (name) => {
    const params = { ...filters };
    if (name === 'topProducts') params.sort_by = 'revenue';
    if (paginatedReports.has(name)) params.limit = 200;
    if (name === 'lowStock') params.threshold = 5;
    if (name === 'staleProducts' || name === 'inactiveClients') params.days = 30;
    if (name === 'newClientsTrend') params.days = 7;
    let result = await reportsApi[name](filialId, params, signal);
    if (paginatedReports.has(name)) {
      if (!Array.isArray(result?.items) || !Number.isInteger(result.total)) throw new ApiError('A API retornou um relatório paginado inválido.');
      const items = [...result.items];
      while (items.length < result.total) {
        const page = await reportsApi[name](filialId, { ...params, offset: items.length }, signal);
        if (!Array.isArray(page?.items) || !page.items.length) throw new ApiError('Não foi possível carregar o relatório completo.');
        items.push(...page.items);
      }
      result = { items, total: result.total };
    }
    return [name, result];
  }));
  return Object.fromEntries(results);
}
