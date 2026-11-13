import { useEffect, useState } from 'react';
import { forecastsApi, optionalForecast } from '../api/analytics';
import useApiQuery from '../hooks/useApiQuery';
import { formatCurrency, formatDate, formatNumber, formatRatio, modelNames, numeric, ratioChangeNote } from '../utils/dashboard';
import { AnalyticsMetric, AnalyticsTable, QueryFeedback, SeriesChart } from './AnalyticsWidgets';

function ForecastConfidence({ filialId, filters, enabled }) {
  const [open, setOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState('');
  const key = JSON.stringify(filters);
  const query = useApiQuery(async (signal) => {
    const [backtest, accuracy, runs] = await Promise.all([
      optionalForecast(() => forecastsApi.backtest(filialId, filters, signal)),
      forecastsApi.accuracy(filialId, filters, signal),
      forecastsApi.runs(filialId, { target: filters.target, limit: 20, kind: 'forecast' }, signal),
    ]);
    return { backtest: backtest.data, accuracy, runs };
  }, `confidence:${filialId}:${key}`, enabled && open);
  const origins = [...(query.data?.backtest?.origins || [])].sort((a, b) => b.train_end.localeCompare(a.train_end));
  const origin = origins.find((item) => String(item.run_id) === selectedRun) || origins[0];
  const currency = filters.target === 'revenue';
  return <section className="panel analytics-section">
    <div className="panel-heading"><h2>Confiança da previsão</h2><button type="button" className="secondary-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? 'Recolher avaliação' : 'Ver avaliação dos modelos'}</button></div>
    {open && <QueryFeedback query={query} empty="Sem dados de avaliação.">
      <p className="analytics-note">WAPE é o erro típico relativo ao total vendido. Valores menores indicam maior precisão. O erro por produto pode ser maior que o da filial.</p>
      <AnalyticsTable columns={['Modelo', 'Horizonte', 'WAPE', 'MAPE', currency ? 'MAE (R$)' : 'MAE (un.)', 'Viés', 'Execuções']} rows={(query.data?.accuracy || []).map((row) => [
        modelNames[row.model] || row.model, `${row.horizon_bucket} dias`, formatRatio(row.wape), formatRatio(row.mape), currency ? formatCurrency(row.mae) : formatNumber(row.mae), formatRatio(row.bias), formatNumber(row.n_runs),
      ])} empty="Os modelos ainda não foram avaliados." />
      <h3>Previsto e realizado no passado</h3>
      {origin ? <>
        <label className="analytics-control">Avaliação retroativa<select aria-label="Avaliação retroativa" value={String(origin.run_id)} onChange={(event) => setSelectedRun(event.target.value)}>{origins.map((item) => <option key={item.run_id} value={item.run_id}>{formatDate(item.train_end)} · {modelNames[item.model] || item.model}</option>)}</select></label>
        <p className="analytics-note">Dados de treino até {formatDate(origin.train_end)} · WAPE desta avaliação: {formatRatio(origin.wape)}. Pontos vermelhos indicam falta de estoque.</p>
        <SeriesChart title="Previsão retroativa e vendas realizadas" currency={currency} points={origin.points.map((point) => ({ ...point, actual: numeric(point.actual), predicted: numeric(point.predicted) }))} series={[{ key: 'actual', label: 'Realizado' }, { key: 'predicted', label: 'Previsto', dashed: true }]} />
      </> : <p className="analytics-note" role="status">Sem avaliações retroativas para este recorte.</p>}
      <details className="analytics-data"><summary>Histórico de execuções da filial</summary><AnalyticsTable columns={['Execução', 'Modelo', 'Versão', 'Treino até', 'Gerada em', 'Horizonte']} rows={(query.data?.runs || []).map((run) => [run.id, modelNames[run.model] || run.model, run.model_version, formatDate(run.train_end), formatDate(run.created_at), `${run.horizon_days} dias`])} /></details>
    </QueryFeedback>}
  </section>;
}

export default function ForecastPanel({ filialId, scope = { level: 'filial' }, enabled = true, onSelectionChange }) {
  const [target, setTarget] = useState('quantity');
  const [model, setModel] = useState('');
  const [horizon, setHorizon] = useState('7');
  const filters = { ...scope, target, model, history_days: 28 };
  const key = JSON.stringify(filters);
  useEffect(() => { onSelectionChange?.({ ...JSON.parse(key), horizon_days: Number(horizon) }); }, [key, horizon, onSelectionChange]);
  const query = useApiQuery(async (signal) => {
    const [summary, comparison] = await Promise.all([
      optionalForecast(() => forecastsApi.summary(filialId, filters, signal)),
      optionalForecast(() => forecastsApi.compare(filialId, filters, signal)),
    ]);
    return { summary: summary.data, comparison: comparison.data };
  }, `forecast:${filialId}:${key}`, enabled);
  const summary = query.data?.summary;
  const comparison = query.data?.comparison;
  const targets = summary?.targets;
  const errorTarget = targets?.[target];
  const horizonKey = horizon === '7' ? 'next_7_days' : 'next_14_days';
  const changeKey = horizon === '7' ? 'change_7_days_pct' : 'change_14_days_pct';
  const forecastNote = (item) => `${ratioChangeNote(item?.[changeKey], 'vs histórico equivalente')} · ${modelNames[item?.model] || 'Modelo não informado'}`;
  const points = [
    ...(comparison?.history || []).map((point) => ({ date: point.date, actual: numeric(point.actual) })),
    ...(comparison?.forecast || []).slice(0, Number(horizon)).map((point) => ({ ...point, predicted: numeric(point.predicted), lower: numeric(point.lower), upper: numeric(point.upper) })),
  ];
  const amount = (value, formatter) => query.loading ? '…' : formatter(value);
  return <>
    <section className="panel analytics-section" aria-busy={query.loading}>
      <div className="panel-heading"><h2>Previsões de vendas</h2><label className="analytics-control">Horizonte<select aria-label="Horizonte da previsão" value={horizon} onChange={(event) => setHorizon(event.target.value)}><option value="7">7 dias</option><option value="14">14 dias</option></select></label></div>
      <div className="analytics-filters">
        <label className="analytics-control">Alvo<select aria-label="Alvo da previsão" value={target} onChange={(event) => setTarget(event.target.value)}><option value="quantity">Quantidade</option><option value="revenue">Receita líquida</option></select></label>
        <label className="analytics-control">Modelo<select aria-label="Modelo da previsão" value={model} onChange={(event) => setModel(event.target.value)}><option value="">Mais preciso (automático)</option>{Object.entries(modelNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      </div>
      <QueryFeedback query={query} empty="Sem dados de vendas para gerar previsões.">
        {!summary && <p className="analytics-note" role="status">Previsões ainda não geradas para este recorte.</p>}
        {summary && <>
          <p className="analytics-note">{summary.entity?.name} · Período previsto após {formatDate(summary.data_until)}. A previsão usa os dados disponíveis até essa data.</p>
          <div className="metrics-grid">
            <AnalyticsMetric label={`Quantidade prevista — ${horizon} dias`} value={amount(targets?.quantity?.[horizonKey], formatNumber)} note={forecastNote(targets?.quantity)} negative={numeric(targets?.quantity?.[changeKey]) < 0} />
            <AnalyticsMetric label={`Receita prevista — ${horizon} dias`} value={amount(targets?.revenue?.[horizonKey], formatCurrency)} note={forecastNote(targets?.revenue)} negative={numeric(targets?.revenue?.[changeKey]) < 0} />
            <AnalyticsMetric label="Erro típico (WAPE) — dias 1 a 7" value={amount(errorTarget?.expected_wape_days_1_7, formatRatio)} note={horizon === '14' ? `Dias 8 a 14: ${formatRatio(errorTarget?.expected_wape_days_8_14)}` : `Alvo: ${target === 'quantity' ? 'quantidade' : 'receita líquida'}`} />
          </div>
        </>}
        {comparison ? <>
          <h3>Histórico e previsão · {comparison.entity?.name}</h3>
          <p className="analytics-note">Modelo: {modelNames[comparison.run?.model] || comparison.run?.model} · Treino até {formatDate(comparison.run?.train_end)} · A faixa sombreada representa 80% de cobertura.</p>
          <SeriesChart title="Histórico real e previsão de vendas com faixa de 80%" points={points} currency={target === 'revenue'} band series={[{ key: 'actual', label: 'Realizado' }, { key: 'predicted', label: 'Previsto', dashed: true }]} />
        </> : summary ? <p className="analytics-note" role="status">Série de previsão ainda não disponível.</p> : null}
      </QueryFeedback>
    </section>
    <ForecastConfidence filialId={filialId} filters={filters} enabled={enabled} />
  </>;
}
