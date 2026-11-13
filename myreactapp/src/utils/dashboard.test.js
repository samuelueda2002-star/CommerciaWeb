import { analyticsPeriod, businessDate, chartPoints, effectivePrice, formatCurrency, formatNumber, formatRatio, moneyToCents, periodDates, ratioChangeNote, totalItems, validateAnalyticsDates } from './dashboard';

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

test('converts analytics fractions to percentages while keeping missing and zero distinct', () => {
  expect(formatRatio('0.1109')).toBe('11,09%');
  expect(formatRatio('0')).toBe('0%');
  expect(formatRatio(null)).toBe('—');
  expect(ratioChangeNote('-0.0289')).toContain('↓ 2,89%');
  expect(ratioChangeNote(null)).toBe('Sem comparação disponível');
});

test('anchors analytics periods to the actual last sale, not to the current date', () => {
  expect(analyticsPeriod('current', '2026-10-30')).toEqual({ start_date: '2026-10-03', end_date: '2026-10-30' });
  expect(analyticsPeriod('previous', '2026-10-30')).toEqual({ start_date: '2026-09-05', end_date: '2026-10-02' });
  expect(analyticsPeriod('current', null)).toBeNull();
});

test('validates inclusive ranges, invalid dates and paired comparison dates', () => {
  expect(validateAnalyticsDates({ start_date: '2026-01-01', end_date: '2027-01-01' })).toBe('');
  expect(validateAnalyticsDates({ start_date: '2026-01-01', end_date: '2027-01-02' })).toMatch(/366/);
  expect(validateAnalyticsDates({ start_date: '2026-02-30', end_date: '2026-03-01' })).toMatch(/início e fim/);
  expect(validateAnalyticsDates({ start_date: '2026-10-01', end_date: '2026-10-28', compare_start_date: '2026-09-01' })).toMatch(/duas datas/);
});

test('uses the Brasilia business day for a UTC timestamp near the month boundary', () => {
  expect(businessDate('2026-11-01T01:30:00Z')).toBe('2026-10-31');
});

test('uses a positive offer price and otherwise the default price, including zero', () => {
  expect(effectivePrice({ price_default: '25.90', price_offer: '0.00' })).toBe(25.9);
  expect(effectivePrice({ price_default: '25.90', price_offer: '20.00' })).toBe(20);
  expect(effectivePrice({ price_default: '0', price_offer: null })).toBe(0);
  expect(effectivePrice(null)).toBeNull();
});

test('parses money to exact cents and rejects precision beyond the audited contract', () => {
  expect(moneyToCents('0,29')).toBe(29);
  expect(moneyToCents('25.9')).toBe(2590);
  expect(moneyToCents('0.005')).toBeNull();
  expect(moneyToCents('-1.00')).toBeNull();
});
