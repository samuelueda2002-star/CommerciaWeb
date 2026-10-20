import { useEffect, useRef, useState } from 'react';
import { createProduct, listCategories, updateProduct } from '../api/resources';
import useApiQuery from '../hooks/useApiQuery';

const measures = { weight: 'Peso', height: 'Altura', width: 'Largura', depth: 'Profundidade' };
const decimal = (value) => Number(value.trim().replace(',', '.'));

function validate(values, categories, product) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Informe o nome do produto.';
  if (!product && !values.sku.trim()) errors.sku = 'Informe o SKU do produto.';
  if (!categories.some((category) => String(category.id) === values.category_id)) {
    errors.category_id = 'Selecione uma categoria disponível.';
  }
  Object.keys(measures).forEach((name) => {
    const value = values[name].trim();
    if (value && (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value) || !Number.isFinite(decimal(value)))) {
      errors[name] = 'Informe um número maior ou igual a zero.';
    } else if (!value && product?.[name] != null) {
      errors[name] = 'Informe uma medida. Para zerar este campo, use 0.';
    }
  });
  return errors;
}

export default function ProductForm({ filialId, product = null, initialCategoryId = '', onClose, onSaved }) {
  const [values, setValues] = useState(() => ({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category_id: String(product?.category_id ?? initialCategoryId),
    brand: product?.brand ?? '',
    barcode: product?.barcode ?? '',
    description: product?.description ?? '',
    ...Object.fromEntries(Object.keys(measures).map((name) => [name, String(product?.[name] ?? '').replace('.', ',')])),
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const dialogRef = useRef(null);
  const controllerRef = useRef(null);
  const submitting = useRef(false);
  const categoryQuery = useApiQuery((signal) => listCategories(filialId, signal), `product-form-categories:${filialId}`);
  const categories = categoryQuery.data || [];
  const categoriesUnavailable = categoryQuery.loading || Boolean(categoryQuery.error) || !categories.length;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    dialog.querySelector('input').focus();
    return () => {
      controllerRef.current?.abort();
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current || categoriesUnavailable) return;
    const validationErrors = validate(values, categories, product);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      event.currentTarget.elements.namedItem(Object.keys(validationErrors)[0]).focus();
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const payload = {
        name: values.name.trim(),
        category_id: Number(values.category_id),
      };
      ['brand', 'barcode', 'description'].forEach((name) => {
        // Empty strings clear text; the update endpoint ignores null values.
        const value = values[name].trim();
        if (!product || value || product[name] != null) payload[name] = value || (product ? '' : null);
      });
      Object.keys(measures).forEach((name) => {
        if (values[name].trim()) payload[name] = decimal(values[name]);
        else if (!product) payload[name] = null;
      });
      if (product) {
        await updateProduct(product.id, payload, controller.signal);
      } else {
        await createProduct(filialId, { ...payload, sku: values.sku.trim() }, controller.signal);
      }
      if (!controller.signal.aborted) onSaved();
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  const field = (name, label, options = {}, multiline = false) => {
    const props = {
      id: `product-${name}`, name, value: values[name], onChange,
      'aria-invalid': Boolean(errors[name]),
      'aria-describedby': errors[name] ? `product-${name}-error` : name === 'sku' && product ? 'product-sku-hint' : undefined,
      ...options,
    };
    return (
      <div className={`record-form-field ${multiline ? 'record-form-field-wide' : ''}`}>
        <label htmlFor={props.id}>{label}{options.required && <span aria-hidden="true"> *</span>}</label>
        {multiline ? <textarea {...props} rows={3} /> : <input {...props} />}
        {name === 'sku' && product && <small id="product-sku-hint" className="record-field-hint">O SKU é definido no cadastro e não pode ser alterado.</small>}
        {errors[name] && <small className="field-error" id={`product-${name}-error`}>{errors[name]}</small>}
      </div>
    );
  };

  return (
    <dialog className="record-dialog" ref={dialogRef} aria-labelledby="product-form-title" aria-describedby="product-form-description"
      onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}>
      <div className="record-dialog-heading">
        <div>
          <h2 id="product-form-title">{product ? 'Editar produto' : 'Novo produto'}</h2>
          <p id="product-form-description">{product ? 'Atualize os dados do produto e salve as alterações.' : 'Preencha os dados para adicionar um produto ao catálogo.'}</p>
        </div>
        <button type="button" className="record-dialog-close" aria-label="Fechar cadastro" onClick={onClose} disabled={pending}>×</button>
      </div>
      <form className="record-form" onSubmit={onSubmit} noValidate aria-busy={pending}>
        <p className="record-form-hint">Os campos com * são obrigatórios.</p>
        {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
        {categoryQuery.error && <div className="product-categories-feedback">
          <p className="form-feedback form-feedback-error" role="alert">Não foi possível carregar as categorias. {categoryQuery.error.message}</p>
          <button type="button" className="secondary-button" onClick={categoryQuery.retry}>Recarregar categorias</button>
        </div>}
        {!categoryQuery.loading && !categoryQuery.error && !categories.length && <p className="form-feedback form-feedback-error" role="status">Nenhuma categoria disponível. Cadastre uma categoria para continuar.</p>}
        <fieldset className="record-form-fields" disabled={pending}>
          {field('name', 'Nome', { required: true, placeholder: 'Nome do produto' })}
          {field('sku', 'SKU', { required: !product, readOnly: Boolean(product), placeholder: 'Ex.: PROD-001' })}
          <div className="record-form-field">
            <label htmlFor="product-category">Categoria<span aria-hidden="true"> *</span></label>
            <select id="product-category" name="category_id" value={values.category_id} onChange={onChange} required disabled={categoriesUnavailable}
              aria-invalid={Boolean(errors.category_id)} aria-describedby={errors.category_id ? 'product-category-error' : undefined}>
              <option value="">{categoryQuery.loading ? 'Carregando categorias...' : 'Selecione uma categoria'}</option>
              {!categoriesUnavailable && values.category_id && !categories.some((category) => String(category.id) === values.category_id) && <option value={values.category_id} disabled>Categoria indisponível</option>}
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            {errors.category_id && <small className="field-error" id="product-category-error">{errors.category_id}</small>}
          </div>
          {field('brand', 'Marca (opcional)', { placeholder: 'Marca do produto' })}
          {field('barcode', 'Código de barras (opcional)', { placeholder: 'Código de barras' })}
          {Object.entries(measures).map(([name, label]) => <div className="record-field-group" key={name}>{field(name, `${label} (opcional)`, { inputMode: 'decimal', placeholder: '0,00' })}</div>)}
          {field('description', 'Descrição (opcional)', { placeholder: 'Descreva o produto' }, true)}
        </fieldset>
        <div className="record-form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={pending || categoriesUnavailable}>{pending ? 'Salvando...' : product ? 'Salvar alterações' : 'Salvar produto'}</button>
        </div>
      </form>
    </dialog>
  );
}
