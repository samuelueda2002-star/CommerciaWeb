import { useState } from 'react';
import { listPurchases, listSuppliers } from '../api/purchases';
import { useAuth } from '../auth/AuthContext';
import useApiQuery from '../hooks/useApiQuery';
import { formatCurrency, formatDate } from '../utils/dashboard';
import { AnalyticsTable } from './AnalyticsWidgets';
import PurchaseDetails, { PurchaseStatus } from './PurchaseDetails';

export default function Purchases() {
  const { session } = useAuth();
  const [filters, setFilters] = useState({ offset: 0, status: '', supplier_id: '', start_date: '', end_date: '' });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [success, setSuccess] = useState('');
  const invalidDates = Boolean(filters.start_date && filters.end_date && filters.start_date > filters.end_date);
  const query = useApiQuery(
    (signal) => listPurchases(session.filialId, filters, signal),
    `purchases:${session.filialId}:${JSON.stringify(filters)}`,
    !invalidDates,
  );
  const suppliers = useApiQuery(
    (signal) => listSuppliers(session.filialId, signal),
    `purchase-suppliers:${session.filialId}`,
  );
  const supplierName = (id) => suppliers.data?.find((supplier) => supplier.id === id)?.name || `Fornecedor #${id}`;
  const changeFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value, offset: 0 }));
  const items = query.data?.items || [];
  const needle = search.trim().toLocaleLowerCase('pt-BR');
  const rows = items.filter((purchase) => {
    const text = `#${purchase.id} ${supplierName(purchase.supplier_id)} ${purchase.invoice_number || ''} ${purchase.client_reference || ''}`;
    return text.toLocaleLowerCase('pt-BR').includes(needle);
  }).map((purchase) => [
    `#${purchase.id}`,
    supplierName(purchase.supplier_id),
    purchase.invoice_number || '—',
    formatDate(purchase.occurred_at || purchase.created_at),
    formatCurrency(purchase.total),
    <PurchaseStatus key={`status-${purchase.id}`} status={purchase.status} />,
    purchase.client_reference ? 'Aplicativo (sync)' : 'Online',
    <button
      key={purchase.id}
      type="button"
      className="table-action-button"
      aria-label={`Conferir compra ${purchase.id}`}
      onClick={() => {
        setSuccess('');
        setSelected({ id: purchase.id, supplier_id: purchase.supplier_id });
      }}
    >Conferir compra</button>,
  ]);

  return <div className="page-stack" aria-busy={query.loading}>
    <section className="page-intro">
      <div>
        <h2>Compras e recebimentos</h2>
        <p>Consulte notas, produtos e valores das compras registradas na filial.</p>
      </div>
      <button type="button" className="primary-button" onClick={query.retry} disabled={query.loading || invalidDates}>Atualizar lista</button>
    </section>
    {success && <p className="form-feedback form-feedback-success" role="status">{success}</p>}
    <section className="panel analytics-section" aria-label="Filtros das compras">
      <div className="analytics-filters">
        <label className="analytics-control">Situação
          <select aria-label="Situação das compras" value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}>
            <option value="">Todas as situações</option>
            <option value="pending">Pendentes</option>
            <option value="received">Recebidas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </label>
        <label className="analytics-control">Fornecedor
          <select aria-label="Fornecedor das compras" value={filters.supplier_id} onChange={(event) => changeFilter('supplier_id', event.target.value)} disabled={suppliers.loading || Boolean(suppliers.error)}>
            <option value="">Todos os fornecedores</option>
            {(suppliers.data || []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className="analytics-control">De
          <input type="date" aria-label="Data inicial das compras" value={filters.start_date} onChange={(event) => changeFilter('start_date', event.target.value)} />
        </label>
        <label className="analytics-control">Até
          <input type="date" aria-label="Data final das compras" value={filters.end_date} onChange={(event) => changeFilter('end_date', event.target.value)} />
        </label>
      </div>
      {invalidDates && <p className="form-feedback form-feedback-error" role="alert">A data final deve ser igual ou posterior à inicial.</p>}
      {suppliers.error && <div className="record-list-error">
        <p role="status">Não foi possível carregar os nomes dos fornecedores. As compras continuam disponíveis pelos códigos.</p>
        <button type="button" className="secondary-button" onClick={suppliers.retry}>Recarregar fornecedores</button>
      </div>}
    </section>
    {query.error && <div className="record-list-error">
      <p role="alert">{query.error.message}</p>
      <button type="button" className="secondary-button" onClick={query.retry}>Tentar novamente</button>
    </div>}
    <article className="panel data-panel">
      <div className="toolbar">
        <label className="search-field">
          <input aria-label="Pesquisar compra nesta página" placeholder="Buscar compra, fornecedor ou nota nesta página..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      <AnalyticsTable
        columns={['Compra', 'Fornecedor', 'Nota fiscal', 'Data', 'Total líquido', 'Situação', 'Origem', 'Conferência']}
        rows={rows}
        empty={invalidDates ? 'Ajuste as datas para consultar as compras.' : query.loading ? 'Carregando compras...' : query.error ? 'Não foi possível carregar as compras.' : 'Nenhuma compra encontrada.'}
      />
      <nav className="sales-pagination" aria-label="Paginação das compras">
        <button type="button" className="secondary-button" onClick={() => setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - 50) }))} disabled={query.loading || filters.offset === 0 || invalidDates}>Anterior</button>
        <span>{query.data ? `${query.data.total ? filters.offset + 1 : 0}–${Math.min(filters.offset + items.length, query.data.total)} de ${query.data.total}` : '—'}</span>
        <button type="button" className="secondary-button" onClick={() => setFilters((current) => ({ ...current, offset: current.offset + 50 }))} disabled={query.loading || !query.data || filters.offset + items.length >= query.data.total || invalidDates}>Próxima</button>
      </nav>
    </article>
    {selected && <PurchaseDetails
      purchaseId={selected.id}
      filialId={session.filialId}
      supplierName={supplierName(selected.supplier_id)}
      onClose={() => {
        setSelected(null);
        query.retry();
      }}
      onReceived={(purchase) => {
        setSelected(null);
        setFilters((current) => ({ ...current, offset: 0 }));
        setSuccess(`Recebimento da compra #${purchase.id} confirmado. Entrada no estoque registrada.`);
        query.retry();
      }}
    />}
  </div>;
}
