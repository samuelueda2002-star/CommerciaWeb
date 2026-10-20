import { request } from './client';

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

export function getIndicators(filialId, signal) {
  return request('/dashboard/indicators', { query: { filial_id: filialId }, signal });
}

export const reportsApi = Object.fromEntries(Object.entries(reportPaths).map(([name, path]) => [
  name,
  (filialId, filters = {}, signal) => {
    const { filial_id: ignoredFilial, ...query } = filters;
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
  return { summary, comparison, categories, weekdays };
}

export async function getAllReports(filialId, filters, signal) {
  const results = await Promise.all(Object.keys(reportPaths).map(async (name) => {
    const params = { ...filters };
    if (name === 'topProducts') params.sort_by = 'revenue';
    if (name === 'salesByClient') params.limit = 50;
    if (name === 'lowStock') params.threshold = 5;
    if (name === 'staleProducts' || name === 'inactiveClients') params.days = 30;
    if (name === 'newClientsTrend') params.days = 7;
    return [name, await reportsApi[name](filialId, params, signal)];
  }));
  return Object.fromEntries(results);
}
