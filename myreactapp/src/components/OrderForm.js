import { useEffect, useRef, useState } from 'react';
import { createOrder, getOrderOptions } from '../api/resources';
import useApiQuery from '../hooks/useApiQuery';
import { effectivePrice, formatCurrency, moneyToCents } from '../utils/dashboard';

const paymentMethods = { pix: 'Pix', cash: 'Dinheiro', debit_card: 'Cartão de débito', credit_card: 'Cartão de crédito', other: 'Outro' };

export default function OrderForm({ filialId, onClose, onSaved }) {
  const query = useApiQuery((signal) => getOrderOptions(filialId, signal), `order-options:${filialId}`);
  const [clientId, setClientId] = useState('');
  const [payment, setPayment] = useState('pix');
  const [discount, setDiscount] = useState('0,00');
  const [items, setItems] = useState([{ key: 0, product_id: '', quantity: '1' }]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const dialogRef = useRef(null);
  const controllerRef = useRef(null);
  const submitting = useRef(false);
  const nextKey = useRef(1);
  const products = (query.data?.products || []).filter((product) => product.price && effectivePrice(product.price) !== null && product.stock?.quantity > 0);
  const clients = query.data?.clients || [];

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => { controllerRef.current?.abort(); dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  const updateItem = (key, field, value) => {
    setItems((current) => current.map((item) => item.key === key ? { ...item, [field]: value } : item));
    setError('');
  };
  const grossCents = items.reduce((total, item) => {
    const product = products.find((entry) => String(entry.id) === item.product_id);
    const price = moneyToCents(effectivePrice(product?.price));
    const quantity = Number(item.quantity);
    return total + (price !== null && Number.isSafeInteger(quantity) && quantity > 0 ? price * quantity : 0);
  }, 0);
  const discountCents = moneyToCents(discount);
  const estimatedTotal = Number.isSafeInteger(grossCents) && discountCents !== null && discountCents <= grossCents ? (grossCents - discountCents) / 100 : null;
  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current || query.loading || query.error) return;
    if (!clients.some((client) => String(client.id) === clientId)) { setError('Selecione um cliente ativo.'); return; }
    if (discountCents === null) { setError('Informe um desconto maior ou igual a zero, com até duas casas decimais.'); return; }
    const quantities = new Map();
    for (const item of items) {
      const product = products.find((entry) => String(entry.id) === item.product_id);
      if (!product) { setError('Selecione um produto ativo, com preço vigente e estoque, em cada item.'); return; }
      if (!/^[1-9]\d*$/.test(item.quantity) || !Number.isSafeInteger(Number(item.quantity))) { setError('A quantidade deve ser um número inteiro maior que zero.'); return; }
      quantities.set(product.id, (quantities.get(product.id) || 0) + Number(item.quantity));
      if (quantities.get(product.id) > product.stock.quantity) { setError(`A quantidade total de ${product.name} excede o estoque disponível (${product.stock.quantity}).`); return; }
    }
    if (!items.length) { setError('Adicione pelo menos um produto.'); return; }
    if (!Number.isSafeInteger(grossCents) || discountCents > grossCents) { setError('O desconto não pode superar o valor dos itens.'); return; }
    const controller = new AbortController();
    controllerRef.current = controller;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const order = await createOrder(filialId, {
        client_id: Number(clientId), payment_method: payment, discount: (discountCents / 100).toFixed(2),
        items: items.map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity) })),
      }, controller.signal);
      if (!controller.signal.aborted) onSaved(order);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  return <dialog ref={dialogRef} className="record-dialog" aria-labelledby="order-form-title" onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}>
    <div className="record-dialog-heading"><div><h2 id="order-form-title">Nova venda</h2><p>Selecione o cliente e os produtos para registrar a venda.</p></div><button type="button" className="record-dialog-close" aria-label="Fechar venda" onClick={onClose} disabled={pending}>×</button></div>
    <form className="record-form" onSubmit={onSubmit} noValidate aria-busy={pending || query.loading}>
      {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
      {query.error && <div className="record-list-error"><p role="alert">{query.error.message}</p><button type="button" className="secondary-button" onClick={query.retry}>Recarregar opções</button></div>}
      {query.loading && <p role="status">Carregando clientes, preços e estoque...</p>}
      {query.data && (!clients.length || !products.length) && <p className="analytics-note" role="status">É necessário ter um cliente ativo e um produto com preço vigente e estoque para registrar uma venda.</p>}
      <fieldset className="order-form-fields" disabled={pending || query.loading || Boolean(query.error)}>
        <div className="record-form-fields">
          <div className="record-form-field record-form-field-wide"><label htmlFor="order-client">Cliente</label><select id="order-client" value={clientId} onChange={(event) => { setClientId(event.target.value); setError(''); }} required><option value="">Selecione...</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.first_name} {client.last_name}</option>)}</select></div>
          <div className="record-form-field"><label htmlFor="order-payment">Forma de pagamento</label><select id="order-payment" value={payment} onChange={(event) => setPayment(event.target.value)}>{Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="record-form-field"><label htmlFor="order-discount">Desconto (R$)</label><input id="order-discount" inputMode="decimal" value={discount} onChange={(event) => { setDiscount(event.target.value); setError(''); }} /></div>
        </div>
        {items.map((item, index) => <div className="order-item-row" key={item.key}>
          <div className="record-form-field"><label htmlFor={`order-product-${item.key}`}>Produto {index + 1}</label><select id={`order-product-${item.key}`} value={item.product_id} onChange={(event) => updateItem(item.key, 'product_id', event.target.value)}><option value="">Selecione...</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatCurrency(effectivePrice(product.price))} · {product.stock.quantity} un.</option>)}</select></div>
          <div className="record-form-field"><label htmlFor={`order-quantity-${item.key}`}>Quantidade {index + 1}</label><input id={`order-quantity-${item.key}`} type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(item.key, 'quantity', event.target.value)} /></div>
          <button type="button" className="table-action-button table-action-danger" aria-label={`Remover item ${index + 1}`} disabled={items.length === 1} onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}>Remover</button>
        </div>)}
        <button type="button" className="secondary-button" onClick={() => setItems((current) => [...current, { key: nextKey.current++, product_id: '', quantity: '1' }])}>Adicionar item</button>
        <p className="analytics-note">Total estimado: <strong>{formatCurrency(estimatedTotal)}</strong>. O preço e o total serão confirmados ao registrar a venda.</p>
      </fieldset>
      <div className="record-form-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button><button type="submit" className="primary-button" disabled={pending || query.loading || Boolean(query.error) || !clients.length || !products.length}>{pending ? 'Registrando...' : 'Registrar venda'}</button></div>
    </form>
  </dialog>;
}
