const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 });
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function numeric(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function formatCurrency(value) {
  const parsed = numeric(value);
  return parsed === null ? '—' : currency.format(parsed);
}

export function formatNumber(value) {
  const parsed = numeric(value);
  return parsed === null ? '—' : number.format(parsed);
}

export function changeNote(value, fallback = 'Sem comparação disponível') {
  const parsed = numeric(value);
  return parsed === null ? fallback : `${parsed < 0 ? '↓' : '↑'} ${formatNumber(Math.abs(parsed))}% vs período anterior`;
}

// Analytics and forecasts return ratios. Legacy dashboard reports still return percentage points.
export function formatRatio(value) {
  const parsed = numeric(value);
  return parsed === null ? '—' : percent.format(parsed);
}

export function ratioChangeNote(value, suffix = 'vs período anterior') {
  const parsed = numeric(value);
  return parsed === null ? 'Sem comparação disponível' : `${parsed < 0 ? '↓' : '↑'} ${formatRatio(Math.abs(parsed))} ${suffix}`;
}

export function businessDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function analyticsPeriod(period, lastSaleDate, days = 28) {
  if (!lastSaleDate) return null;
  const end = new Date(`${lastSaleDate}T12:00:00Z`);
  if (period === 'previous') end.setUTCDate(end.getUTCDate() - days);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) };
}

export function validateAnalyticsDates(filters) {
  const date = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
  };
  const start = date(filters.start_date);
  const end = date(filters.end_date);
  if (!start || !end) return 'Informe as datas de início e fim.';
  const days = (end - start) / 86400000 + 1;
  if (days < 1) return 'A data final deve ser igual ou posterior à inicial.';
  if (days > 366) return 'Selecione um período de até 366 dias.';
  if (filters.compare_start_date || filters.compare_end_date) {
    const compareStart = date(filters.compare_start_date);
    const compareEnd = date(filters.compare_end_date);
    if (!compareStart || !compareEnd) return 'Informe as duas datas de comparação ou deixe ambas em branco.';
    const compareDays = (compareEnd - compareStart) / 86400000 + 1;
    if (compareDays < 1 || compareDays > 366) return 'A comparação deve ter de 1 a 366 dias.';
  }
  return '';
}

export const modelNames = {
  moving_average: 'Média móvel', weighted_moving_average: 'Média móvel ponderada',
  exp_smoothing: 'Suavização exponencial', period_comparison: 'Comparação anual',
};

export function effectivePrice(price) {
  const offer = numeric(price?.price_offer);
  return offer !== null && offer > 0 ? offer : numeric(price?.price_default);
}

export function moneyToCents(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimals = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function displayName(user) {
  return user?.full_name || user?.name || user?.username || user?.email || 'Usuário';
}

function dateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function periodDates(period = 'current', now = new Date()) {
  const end = new Date(now);
  if (period === 'previous') end.setDate(end.getDate() - 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start_date: dateString(start), end_date: dateString(end) };
}

export function chartPoints(points, byWeekday = false) {
  if (!Array.isArray(points)) return [];
  // Python's weekday numbering starts on Monday; ISO dates use the local day.
  return points.map((point) => {
    const day = numeric(point.weekday);
    const date = point.date ? new Date(`${point.date.slice(0, 10)}T12:00:00`) : null;
    const label = byWeekday && day !== null
      ? weekdays[(day + 1) % 7]
      : date && !Number.isNaN(date.getTime()) ? weekdays[date.getDay()] : '—';
    return { label, total: numeric(point.total ?? point.total_revenue), date: point.date };
  });
}

export function totalItems(categories) {
  if (!Array.isArray(categories)) return null;
  const quantities = categories.map((category) => numeric(category.quantity_sold));
  return quantities.some((value) => value === null) ? null : quantities.reduce((sum, value) => sum + value, 0);
}

export function downloadReports(reports, filters) {
  // JSON preserves every report's fields and precision without inventing a CSV schema.
  const blob = new Blob([JSON.stringify({ period: filters, reports }, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorios-${filters.start_date}-${filters.end_date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
