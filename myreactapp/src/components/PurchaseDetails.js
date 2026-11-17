import { useEffect, useRef, useState } from 'react';
import { getPurchase, getPurchaseProductNames, receivePurchase } from '../api/purchases';
import useApiQuery from '../hooks/useApiQuery';
import { formatCurrency, formatDate, formatNumber } from '../utils/dashboard';
import { AnalyticsTable, QueryFeedback } from './AnalyticsWidgets';

export const purchaseStatuses = { pending: 'Pendente', received: 'Recebida', cancelled: 'Cancelada' };
const statusClasses = { pending: 'pendente', received: 'ativo', cancelled: 'cancelado' };

export function PurchaseStatus({ status }) {
  return <span className={`status status-${statusClasses[status] || 'desconhecido'}`}>
    {purchaseStatuses[status] || status || 'Não informado'}
  </span>;
}

export default function PurchaseDetails({ purchaseId, filialId, supplierName, onClose, onReceived }) {
  const dialogRef = useRef(null);
  const controllerRef = useRef(null);
  const submitting = useRef(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const query = useApiQuery((signal) => getPurchase(purchaseId, signal), `purchase:${purchaseId}`);
  const purchase = query.data;
  const productIds = (purchase?.items || []).map((item) => item.product_id);
  const names = useApiQuery(
    (signal) => getPurchaseProductNames(productIds, signal),
    `purchase-names:${purchaseId}:${productIds.join(',')}`,
    productIds.length > 0,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      controllerRef.current?.abort();
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    setAcknowledged(false);
  }, [purchase?.id, purchase?.updated_at, purchase?.status]);

  const correctPurchase = purchase?.id === purchaseId && purchase?.filial_id === filialId;
  const canReceive = correctPurchase && purchase?.status === 'pending' && purchase?.items?.length > 0;
  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current || !acknowledged || !canReceive || names.loading) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const result = await receivePurchase(purchaseId, controller.signal);
      if (!controller.signal.aborted) onReceived(result);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure.message);
        setAcknowledged(false);
        query.retry();
      }
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  return <dialog
    ref={dialogRef}
    className="record-dialog purchase-dialog"
    aria-labelledby="purchase-details-title"
    onCancel={(event) => {
      event.preventDefault();
      if (!submitting.current) onClose();
    }}
  >
    <div className="record-dialog-heading">
      <div>
        <h2 id="purchase-details-title">Conferir compra #{purchaseId}</h2>
        <p>Confira os produtos, as quantidades e os valores da nota.</p>
      </div>
      <button type="button" className="record-dialog-close" aria-label="Fechar compra" onClick={onClose} disabled={pending}>×</button>
    </div>
    {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
    <QueryFeedback query={query}>
      <dl className="purchase-summary">
        <div><dt>Fornecedor</dt><dd>{supplierName || `Fornecedor #${purchase?.supplier_id}`}</dd></div>
        <div><dt>Situação</dt><dd><PurchaseStatus status={purchase?.status} /></dd></div>
        <div><dt>Nota fiscal</dt><dd>{purchase?.invoice_number || 'Não informada'}</dd></div>
        <div><dt>Emissão</dt><dd>{formatDate(purchase?.issued_at)}</dd></div>
        <div><dt>Data da compra</dt><dd>{formatDate(purchase?.occurred_at || purchase?.created_at)}</dd></div>
        <div><dt>Registro no servidor</dt><dd>{formatDate(purchase?.created_at)}</dd></div>
        <div><dt>Recebimento</dt><dd>{formatDate(purchase?.received_at)}</dd></div>
        <div><dt>Origem</dt><dd>{purchase?.client_reference ? 'Aplicativo (sincronizada)' : 'Registro online'}</dd></div>
      </dl>
      {purchase?.client_reference && <p className="analytics-note purchase-reference">Referência do aplicativo: {purchase.client_reference}</p>}
      {purchase?.invoice_key && <p className="analytics-note purchase-reference">Chave da NF-e: {purchase.invoice_key}</p>}
      {purchase?.status === 'received' && <p className="analytics-note" role="status">Esta compra já consta como recebida na API. A entrada no estoque já foi registrada.</p>}
      {names.error && <p className="analytics-note" role="status">Os nomes dos produtos não estão disponíveis. Confira pelos códigos.</p>}
      <AnalyticsTable
        columns={['Produto', 'Quantidade', 'Custo unitário', 'Total bruto', 'Desconto', 'Frete', 'Total líquido', 'Custo final/un.']}
        rows={(purchase?.items || []).map((item) => [
          names.data?.[item.product_id] || `Produto #${item.product_id}`,
          formatNumber(item.quantity),
          formatCurrency(item.unit_cost),
          formatCurrency(item.total),
          formatCurrency(item.discount_allocated),
          formatCurrency(item.freight_allocated),
          formatCurrency(item.net_total),
          formatCurrency(item.landed_unit_cost),
        ])}
        empty="Nenhum item retornado para esta compra."
      />
      <p className="analytics-note">Desconto: {formatCurrency(purchase?.discount)} · Frete: {formatCurrency(purchase?.freight)} · Total líquido: <strong>{formatCurrency(purchase?.total)}</strong></p>
      {purchase?.notes && <p className="analytics-note purchase-reference">Observações: {purchase.notes}</p>}
      {purchase && !correctPurchase && <p className="form-feedback form-feedback-error" role="alert">A compra retornada não corresponde à filial ou à compra selecionada. O recebimento não pode ser confirmado.</p>}
      {correctPurchase && purchase?.status === 'pending' && !purchase?.items?.length && <p className="analytics-note" role="status">Não é possível confirmar o recebimento sem conferir os itens da compra.</p>}
    </QueryFeedback>
    <form onSubmit={onSubmit} className="record-form" aria-busy={pending}>
      {canReceive && <>
        <p className="record-delete-warning" id="purchase-receive-warning">Ao confirmar, todos os itens desta compra entram no estoque da filial. A confirmação também pode atualizar o custo dos produtos.</p>
        <label className="user-option">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={pending || names.loading}
            aria-describedby="purchase-receive-warning"
          />
          <span>Conferi os itens, as quantidades e os valores e confirmo o recebimento integral desta compra.</span>
        </label>
      </>}
      <div className="record-form-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Fechar</button>
        {canReceive && <button type="submit" className="primary-button" disabled={pending || !acknowledged || names.loading}>
          {pending ? 'Confirmando...' : 'Confirmar recebimento'}
        </button>}
      </div>
    </form>
  </dialog>;
}
