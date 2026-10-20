import { chartPoints, formatCurrency, formatNumber, periodDates, totalItems } from './dashboard';

test('formats decimal API strings, real zero values, and missing values distinctly', () => {
  expect(formatCurrency('0')).toMatch(/0,00/);
  expect(formatNumber(0)).toBe('0');
  expect(formatCurrency(null)).toBe('—');
  expect(formatNumber(undefined)).toBe('—');
});

test('calculates seven-day periods across a month boundary', () => {
  const now = new Date(2026, 9, 2, 12);
  expect(periodDates('current', now)).toEqual({ start_date: '2026-09-26', end_date: '2026-10-02' });
  expect(periodDates('previous', now)).toEqual({ start_date: '2026-09-19', end_date: '2026-09-25' });
});

test('maps ISO dates and Python weekday indexes without a timezone day shift', () => {
  expect(chartPoints([{ date: '2026-10-15', total: '0' }])).toEqual([{ label: 'Qui', total: 0, date: '2026-10-15' }]);
  expect(chartPoints([{ weekday: 0, total: '20' }], true)[0].label).toBe('Seg');
  expect(chartPoints([{ weekday: 6, total: '20' }], true)[0].label).toBe('Dom');
});

test('sums all category quantities and does not fabricate missing quantities', () => {
  expect(totalItems([{ quantity_sold: 2 }, { quantity_sold: '3' }])).toBe(5);
  expect(totalItems([])).toBe(0);
  expect(totalItems([{ name: 'No quantity' }])).toBeNull();
});
