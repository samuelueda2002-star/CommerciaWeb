import { useEffect, useRef, useState } from 'react';
import { analyticsApi, exportAnalytics, getAnalyticsPerformance } from '../api/analytics';
import { getAllReports } from '../api/dashboard';
import { getDepartments, listCategories, listProducts } from '../api/resources';
import useApiQuery from '../hooks/useApiQuery';
import { analyticsPeriod, downloadReports, formatCurrency, formatDate, formatNumber, formatRatio, numeric, ratioChangeNote, validateAnalyticsDates } from '../utils/dashboard';
import { AnalyticsMetric, AnalyticsTable, DataFreshness, QueryFeedback, SeriesChart } from './AnalyticsWidgets';
import ForecastPanel from './ForecastPanel';

function StockAlerts({ filialId, filters, enabled }) {
  const [productId, setProductId] = useState('');
  const query = useApiQuery((signal) => analyticsApi.stockouts(filialId, { ...filters, limit: 20 }, signal), `stockouts:${filialId}:${JSON.stringify(filters)}`, enabled);
  const stock = useApiQuery((signal) => analyticsApi.stockDaily(filialId, { ...filters, product_id: productId }, signal), `stock:${filialId}:${productId}:${JSON.stringify(filters)}`, enabled && Boolean(productId));
  return <section className="panel analytics-section">
    <div className="panel-heading"><h2>Alertas de falta de estoque</h2></div>
    <p className="analytics-note">Os 20 produtos da filial com mais dias sem estoque no período. O saldo atual mostra se a falta já foi resolvida.</p>
    <QueryFeedback query={query} empty="Sem dados de estoque."><AnalyticsTable columns={['Produto', 'Categoria', 'Dias sem estoque', 'Última falta', 'Saldo atual', 'Histórico']} rows={(query.data?.items || []).map((item) => [item.product_name, item.category_name, formatNumber(item.days_out), formatDate(item.last_out_date), formatNumber(item.current_qty), <button key={item.product_id} type="button" className="table-action-button" onClick={() => setProductId(String(item.product_id))} aria-label={`Ver estoque de ${item.product_name}`}>Ver estoque</button>])} empty="Nenhuma falta de estoque registrada no período." /></QueryFeedback>
    {productId && <div className="analytics-stock-detail"><QueryFeedback query={stock}>
      <h3>Estoque · {stock.data?.entity?.name}</h3>
      <SeriesChart title={`Estoque diário de ${stock.data?.entity?.name || 'produto'}`} points={(stock.data?.points || []).map((point) => ({ ...point, out_of_stock: point.was_out_of_stock }))} series={[{ key: 'end_of_day_qty', label: 'Saldo no fim do dia' }, { key: 'min_qty', label: 'Menor saldo do dia', dashed: true }]} />
      <p className="analytics-note">Pontos vermelhos indicam dias com falta de estoque.</p>
    </QueryFeedback></div>}
  </section>;
}

function Ranking({ filialId, filters, enabled, level, onLevelChange, metric, onMetricChange }) {
  const query = useApiQuery((signal) => analyticsApi.salesRanking(filialId, { ...filters, level, metric, limit: 10 }, signal), `ranking:${filialId}:${level}:${metric}:${filters.start_date}:${filters.end_date}`, enabled);
  return <section className="panel analytics-section">
    <div className="panel-heading"><h2>Top 10 de vendas</h2></div>
    <div className="analytics-filters">
      <label className="analytics-control">Agrupar por<select aria-label="Nível do ranking" value={level} onChange={(event) => onLevelChange(event.target.value)}><option value="product">Produto</option><option value="category">Categoria</option><option value="department">Departamento</option></select></label>
      <label className="analytics-control">Ordenar por<select aria-label="Métrica do ranking" value={metric} onChange={(event) => onMetricChange(event.target.value)}><option value="revenue">Receita líquida</option><option value="quantity">Quantidade</option><option value="margin">Margem</option></select></label>
    </div>
    <p className="analytics-note">Ranking da filial no período selecionado. Participação calculada sobre o total da filial.</p>
    <QueryFeedback query={query} empty="Sem dados de ranking."><AnalyticsTable columns={['Nome', 'Quantidade', 'Receita líquida', 'Custo', 'Margem', 'Margem %', 'Participação']} rows={(query.data?.items || []).map((item) => [item.name, formatNumber(item.quantity), formatCurrency(item.revenue), formatCurrency(item.cost), formatCurrency(item.margin), formatRatio(item.margin_pct), formatRatio(item.share_pct)])} /></QueryFeedback>
  </section>;
}

export default function AnalyticsReports({ filialId }) {
  const [period, setPeriod] = useState('current');
  const [customDates, setCustomDates] = useState({ start_date: '', end_date: '' });
  const [compareDates, setCompareDates] = useState({ compare_start_date: '', compare_end_date: '' });
  const [level, setLevel] = useState('filial');
  const [entityId, setEntityId] = useState('');
  const [rankingLevel, setRankingLevel] = useState('product');
  const [metric, setMetric] = useState('revenue');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportController = useRef(null);
  const exportPending = useRef(false);
  const forecastSelection = useRef({ level: 'filial', target: 'quantity', model: '', history_days: 28 });
  const status = useApiQuery((signal) => analyticsApi.status(filialId, {}, signal), `analytics-status:${filialId}`);
  const hasData = Boolean(status.data?.last_sale_date);
  const defaultDates = analyticsPeriod(period, status.data?.last_sale_date);
  const dates = period === 'custom' ? customDates : defaultDates || customDates;
  const filters = { ...dates, ...compareDates, level, ...(level !== 'filial' ? { entity_id: entityId } : {}) };
  const datesError = hasData ? validateAnalyticsDates(filters) ||
    (dates.end_date > status.data.last_sale_date || compareDates.compare_end_date > status.data.last_sale_date
      ? `Não há dados de vendas após ${formatDate(status.data.last_sale_date)}. Selecione um período até essa data.` : '') : '';
  const scopeReady = level === 'filial' || Boolean(entityId);
  const enabled = hasData && !datesError && scopeReady;
  const scope = { level, ...(level !== 'filial' ? { entity_id: entityId } : {}) };
  const query = useApiQuery((signal) => getAnalyticsPerformance(filialId, filters, signal), `performance:${filialId}:${JSON.stringify(filters)}`, enabled);
  const entities = useApiQuery((signal) => level === 'product' ? listProducts(filialId, signal) : level === 'category' ? listCategories(filialId, signal) : getDepartments(signal), `analytics-entities:${filialId}:${level}`, level !== 'filial');
  const selectionKey = JSON.stringify({ filters, rankingLevel, metric });
  useEffect(() => {
    setExportError('');
    setExporting(false);
    exportPending.current = false;
    return () => exportController.current?.abort();
  }, [selectionKey]);

  const exportReport = async () => {
    if (!enabled || exportPending.current) return;
    const controller = new AbortController();
    exportController.current = controller;
    exportPending.current = true;
    setExporting(true);
    setExportError('');
    const selectedForecast = { ...forecastSelection.current };
    try {
      const [legacy, analytics] = await Promise.all([
        getAllReports(filialId, dates, controller.signal),
        exportAnalytics(filialId, { ...filters, ranking_level: rankingLevel, metric }, selectedForecast, level === 'product' ? entityId : null, controller.signal),
      ]);
      if (!controller.signal.aborted) downloadReports({ legacy: { scope: 'filial', reports: legacy }, analytics, selection: { ...filters, ranking_level: rankingLevel, metric, forecast: selectedForecast } }, dates);
    } catch (error) {
      if (!controller.signal.aborted) setExportError(error.message);
    } finally {
      if (!controller.signal.aborted) { exportPending.current = false; setExporting(false); }
    }
  };

  const totals = query.data?.comparison?.current;
  const changes = query.data?.comparison?.change_pct;
  const error = datesError || exportError;
  const amount = (value, formatter) => query.loading ? '…' : formatter(value);
  return <div className="page-stack" aria-busy={query.loading || exporting}>
    <section className="page-intro"><div><h2>Visão geral de desempenho</h2><p>Acompanhe vendas líquidas, estoque e previsões do seu negócio.</p></div><button type="button" className="primary-button" onClick={exportReport} disabled={!enabled || query.loading || exporting}>{exporting ? 'Exportando...' : 'Exportar relatório'}</button></section>
    <DataFreshness query={status} />
    <section className="panel analytics-section" aria-label="Filtros dos relatórios">
      <div className="analytics-filters">
        <label className="analytics-control">Período<select aria-label="Período" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="current">Últimos 28 dias com dados</option><option value="previous">28 dias anteriores</option><option value="custom">Personalizado</option></select></label>
        <label className="analytics-control">De<input type="date" aria-label="Data inicial" value={dates.start_date} onChange={(event) => { setCustomDates({ ...dates, start_date: event.target.value }); setPeriod('custom'); }} /></label>
        <label className="analytics-control">Até<input type="date" aria-label="Data final" value={dates.end_date} onChange={(event) => { setCustomDates({ ...dates, end_date: event.target.value }); setPeriod('custom'); }} /></label>
        <label className="analytics-control">Recorte<select aria-label="Nível da análise" value={level} onChange={(event) => { setLevel(event.target.value); setEntityId(''); }}><option value="filial">Filial inteira</option><option value="category">Categoria</option><option value="department">Departamento</option><option value="product">Produto</option></select></label>
        {level !== 'filial' && <label className="analytics-control">Entidade<select aria-label="Entidade da análise" value={entityId} onChange={(event) => setEntityId(event.target.value)} disabled={entities.loading || Boolean(entities.error)}><option value="">Selecione...</option>{(entities.data || []).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>}
      </div>
      <details className="analytics-data"><summary>Comparar com outro período</summary><p className="analytics-note">Deixe as duas datas em branco para comparar com o período imediatamente anterior.</p><div className="analytics-filters">
        <label className="analytics-control">Comparar de<input type="date" aria-label="Comparação inicial" value={compareDates.compare_start_date} onChange={(event) => setCompareDates((current) => ({ ...current, compare_start_date: event.target.value }))} /></label>
        <label className="analytics-control">Comparar até<input type="date" aria-label="Comparação final" value={compareDates.compare_end_date} onChange={(event) => setCompareDates((current) => ({ ...current, compare_end_date: event.target.value }))} /></label>
      </div></details>
      {entities.error && <QueryFeedback query={entities} />}
      {level !== 'filial' && !entityId && <p className="analytics-note" role="status">Selecione uma entidade para consultar a análise.</p>}
      {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
    </section>
    {enabled && <QueryFeedback query={query}>
      <p className="analytics-note">{query.data?.comparison?.entity?.name} · {formatDate(dates.start_date)} a {formatDate(dates.end_date)} · Comparação: {formatDate(query.data?.comparison?.previous?.start_date)} a {formatDate(query.data?.comparison?.previous?.end_date)}</p>
      <section className="metrics-grid metrics-four">
        {[['Receita líquida', 'revenue', formatCurrency], ['Custo', 'cost', formatCurrency], ['Margem bruta', 'margin', formatCurrency], ['Itens vendidos', 'quantity', formatNumber]].map(([label, key, formatter]) => <AnalyticsMetric key={key} label={label} value={amount(totals?.[key], formatter)} note={ratioChangeNote(changes?.[key])} negative={numeric(changes?.[key]) < 0} />)}
      </section>
      <section className="panel analytics-section"><div className="panel-heading"><h2>Faturamento por dia</h2></div><SeriesChart title="Receita líquida consolidada por dia" points={query.data?.daily?.points} currency series={[{ key: 'revenue', label: 'Receita líquida' }]} /></section>
    </QueryFeedback>}
    <Ranking filialId={filialId} filters={filters} enabled={hasData && !datesError} level={rankingLevel} onLevelChange={setRankingLevel} metric={metric} onMetricChange={setMetric} />
    <StockAlerts filialId={filialId} filters={filters} enabled={hasData && !datesError} />
    <ForecastPanel filialId={filialId} scope={scope} enabled={hasData && scopeReady} onSelectionChange={(value) => { forecastSelection.current = value; }} />
  </div>;
}
