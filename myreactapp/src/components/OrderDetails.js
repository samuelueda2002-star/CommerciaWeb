import { useEffect, useRef } from 'react';
import { getOrder } from '../api/resources';
import useApiQuery from '../hooks/useApiQuery';
import { formatCurrency, formatNumber } from '../utils/dashboard';
import { AnalyticsTable, QueryFeedback } from './AnalyticsWidgets';

export default function OrderDetails({ orderId, onClose }) {
  const dialogRef = useRef(null);
  const query = useApiQuery((signal) => getOrder(orderId, signal), `order-details:${orderId}`);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <dialog ref={dialogRef} className="record-dialog" aria-labelledby="order-details-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="record-dialog-heading"><div><h2 id="order-details-title">Itens do pedido #{orderId}</h2><p>O desconto é distribuído entre os itens. A receita considera o valor líquido.</p></div><button type="button" className="record-dialog-close" aria-label="Fechar detalhes" onClick={onClose}>×</button></div>
    <QueryFeedback query={query}><AnalyticsTable columns={['Produto', 'Quantidade', 'Valor bruto', 'Desconto rateado', 'Receita líquida']} rows={(query.data?.items || []).map((item) => [`#${item.product_id}`, formatNumber(item.quantity), formatCurrency(item.total), formatCurrency(item.discount_allocated), formatCurrency(item.net_total)])} />
      <p className="analytics-note">Desconto do pedido: {formatCurrency(query.data?.discount)} · Total líquido: {formatCurrency(query.data?.total)}</p>
    </QueryFeedback>
    <div className="record-form-actions"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button></div>
  </dialog>;
}
