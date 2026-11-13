import { formatCurrency, formatDate, formatNumber, numeric } from '../utils/dashboard';

export function QueryFeedback({ query, empty = 'Sem dados disponíveis.', children }) {
  if (query.loading) return <p className="analytics-note" role="status">Carregando...</p>;
  if (query.error) return <div className="record-list-error"><p role="alert">{query.error.message}</p><button type="button" className="secondary-button" onClick={query.retry}>Tentar novamente</button></div>;
  if (!query.data) return <p className="analytics-note" role="status">{empty}</p>;
  return children;
}

export function AnalyticsTable({ columns, rows, empty = 'Nenhum registro encontrado.' }) {
  return <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>
    {rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={columns.length} role="status">{empty}</td></tr>}
  </tbody></table></div>;
}

export function AnalyticsMetric({ label, value, note, negative = false }) {
  return <article className="metric-card"><div className="metric-label">{label}</div><strong>{value}</strong><small className={negative ? 'negative' : 'positive'}>{note}</small></article>;
}

export function DataFreshness({ query }) {
  if (query.loading) return <p className="analytics-note" role="status">Consultando atualização dos dados...</p>;
  if (query.error) return <QueryFeedback query={query} />;
  const status = query.data;
  const failed = ['failed', 'error', 'failure'].includes(status?.last_job?.status);
  return <div className="analytics-freshness">
    {status?.last_sale_date ? <p className="analytics-note">Dados consolidados até {formatDate(status.last_day)} · Última venda: {formatDate(status.last_sale_date)}{status.last_successful_job_at ? ` · Atualização: ${formatDate(status.last_successful_job_at)}` : ''}</p> : <p className="analytics-note" role="status">Sem dados de vendas ainda.</p>}
    {failed && <p className="form-feedback form-feedback-error" role="alert">A última atualização falhou. Os números exibidos podem estar desatualizados.</p>}
  </div>;
}

export function SeriesChart({ title, points = [], series, band = false, currency = false, empty = 'Sem dados para este período.' }) {
  const width = 720;
  const height = 255;
  const left = 68;
  const right = 700;
  const top = 20;
  const bottom = 205;
  const formatter = currency ? formatCurrency : formatNumber;
  const keys = [...series.map((line) => line.key), ...(band ? ['lower', 'upper'] : [])];
  const values = points.flatMap((point) => keys.map((key) => numeric(point[key])).filter((value) => value !== null));
  if (!points.length || !values.length) return <p className="analytics-note" role="status">{empty}</p>;
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const range = maximum - minimum || 1;
  const x = (index) => left + (right - left) * index / Math.max(1, points.length - 1);
  const y = (value) => bottom - (Number(value) - minimum) / range * (bottom - top);
  const path = (key) => {
    let drawing = false;
    return points.map((point, index) => {
      const value = numeric(point[key]);
      if (value === null) { drawing = false; return ''; }
      const command = `${drawing ? 'L' : 'M'}${x(index)},${y(value)}`;
      drawing = true;
      return command;
    }).join(' ');
  };
  const bands = [];
  if (band) {
    let segment = [];
    const finish = () => { if (segment.length) bands.push(segment); segment = []; };
    points.forEach((point, index) => {
      if (numeric(point.lower) !== null && numeric(point.upper) !== null) segment.push({ ...point, index });
      else finish();
    });
    finish();
  }
  const tickIndexes = [...new Set([0, ...Array.from({ length: 4 }, (_, index) => Math.round((index + 1) * (points.length - 1) / 5)), points.length - 1])];
  return <div className="analytics-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      <title>{title}</title>
      <desc>{series.map((line) => line.label).join(', ')}. {band ? 'A área sombreada indica a faixa de previsão de 80%.' : ''}</desc>
      {Array.from({ length: 4 }, (_, index) => {
        const value = minimum + range * index / 3;
        return <g key={index}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="analytics-gridline" /><text x={left - 9} y={y(value) + 4} textAnchor="end" className="analytics-axis">{formatNumber(value)}</text></g>;
      })}
      {bands.map((segment, index) => <path key={index} fill="var(--orange)" opacity="0.15" d={`${segment.map((point, i) => `${i ? 'L' : 'M'}${x(point.index)},${y(point.upper)}`).join(' ')} ${[...segment].reverse().map((point) => `L${x(point.index)},${y(point.lower)}`).join(' ')} Z`} />)}
      {series.map((line, lineIndex) => <g key={line.key}>
        <path d={path(line.key)} fill="none" stroke={line.color || (lineIndex ? 'var(--orange)' : 'var(--navy)')} strokeWidth="2.5" strokeDasharray={line.dashed ? '6 5' : undefined} />
        {points.map((point, index) => numeric(point[line.key]) === null ? null : <circle key={index} cx={x(index)} cy={y(point[line.key])} r={point.out_of_stock ? 4 : 2.8} fill={point.out_of_stock ? 'var(--red)' : line.color || (lineIndex ? 'var(--orange)' : 'var(--navy)')} tabIndex="0" aria-label={`${formatDate(point.date)}, ${line.label}: ${formatter(point[line.key])}${point.out_of_stock ? ', falta de estoque' : ''}`}>
          <title>{formatDate(point.date)} · {line.label}: {formatter(point[line.key])}{band && point.lower != null ? ` · Faixa de 80%: ${formatter(point.lower)} a ${formatter(point.upper)}` : ''}{point.out_of_stock ? ' · Falta de estoque' : ''}</title>
        </circle>)}
      </g>)}
      {tickIndexes.map((index) => <text key={index} x={x(index)} y={bottom + 25} textAnchor="middle" className="analytics-axis">{formatDate(points[index].date).slice(0, 5)}</text>)}
    </svg>
    <p className="analytics-legend">{series.map((line, index) => <span key={line.key}><i style={{ background: line.color || (index ? 'var(--orange)' : 'var(--navy)') }} />{line.label}{line.dashed ? ' (tracejado)' : ''}</span>)}{band && <span>Faixa sombreada: 80%</span>}{currency && <span>Valores em R$</span>}</p>
    <details className="analytics-data"><summary>Ver valores do gráfico</summary><AnalyticsTable columns={['Data', ...series.map((line) => line.label), ...(band ? ['Limite inferior (80%)', 'Limite superior (80%)'] : [])]} rows={points.map((point) => [formatDate(point.date), ...series.map((line) => formatter(point[line.key])), ...(band ? [formatter(point.lower), formatter(point.upper)] : [])])} /></details>
  </div>;
}
