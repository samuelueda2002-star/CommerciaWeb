import { request } from './client';

function endpoint(path, allowed) {
  return (filialId, filters = {}, signal) => {
    const query = { filial_id: filialId };
    allowed.forEach((key) => { if (filters[key] !== undefined && filters[key] !== '') query[key] = filters[key]; });
    if (query.level === 'filial' && path !== '/forecasts') delete query.entity_id;
    return request(path, { query, signal });
  };
}

const scope = ['level', 'entity_id'];
const dates = ['start_date', 'end_date'];
export const analyticsApi = {
  status: endpoint('/analytics/status', []),
  salesDaily: endpoint('/analytics/sales/daily', [...scope, ...dates]),
  salesCompare: endpoint('/analytics/sales/compare', [...scope, ...dates, 'compare_start_date', 'compare_end_date']),
  salesRanking: endpoint('/analytics/sales/ranking', ['level', 'metric', 'limit', ...dates]),
  stockDaily: endpoint('/analytics/stock/daily', ['product_id', ...dates]),
  stockouts: endpoint('/analytics/stockouts', ['limit', ...dates]),
};

export const forecastsApi = {
  points: endpoint('/forecasts', [...scope, 'target', 'model']),
  compare: endpoint('/forecasts/compare', [...scope, 'target', 'model', 'history_days']),
  summary: endpoint('/forecasts/summary', [...scope, 'model']),
  backtest: endpoint('/forecasts/backtest', [...scope, 'target', 'model']),
  runs: endpoint('/forecasts/runs', ['target', 'kind', 'limit']),
  accuracy: endpoint('/forecasts/accuracy', ['target', 'level', 'kind']),
};

export async function getAnalyticsPerformance(filialId, filters, signal) {
  const [comparison, daily] = await Promise.all([
    analyticsApi.salesCompare(filialId, filters, signal),
    analyticsApi.salesDaily(filialId, filters, signal),
  ]);
  return { comparison, daily };
}

export async function optionalForecast(loader) {
  try {
    return { data: await loader(), unavailable: false };
  } catch (error) {
    if (error.status === 404) return { data: null, unavailable: true, message: error.message };
    throw error;
  }
}

export async function exportAnalytics(filialId, filters, forecastFilters, productId, signal) {
  const [status, daily, comparison, ranking, stockouts, forecastEntries, stockDaily] = await Promise.all([
    analyticsApi.status(filialId, {}, signal),
    analyticsApi.salesDaily(filialId, filters, signal),
    analyticsApi.salesCompare(filialId, filters, signal),
    analyticsApi.salesRanking(filialId, { ...filters, level: filters.ranking_level || 'product', limit: 100, metric: filters.metric || 'revenue' }, signal),
    analyticsApi.stockouts(filialId, { ...filters, limit: 100 }, signal),
    Promise.all(Object.entries(forecastsApi).map(async ([name, loader]) => {
      const params = { ...forecastFilters };
      if (name === 'points' && params.level === 'filial') params.entity_id = filialId;
      return [name, await optionalForecast(() => loader(filialId, params, signal))];
    })),
    productId ? analyticsApi.stockDaily(filialId, { ...filters, product_id: productId }, signal) : null,
  ]);
  return { status, daily, comparison, ranking, stockouts, stockDaily, forecasts: Object.fromEntries(forecastEntries) };
}
