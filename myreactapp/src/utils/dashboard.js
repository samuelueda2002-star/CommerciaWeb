const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
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
