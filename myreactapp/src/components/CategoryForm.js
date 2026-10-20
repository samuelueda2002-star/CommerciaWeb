import { useEffect, useRef, useState } from 'react';
import { createCategory, getDepartments, updateCategory } from '../api/resources';
import useApiQuery from '../hooks/useApiQuery';

export default function CategoryForm({ filialId, category = null, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({ name: category?.name ?? '', department_id: String(category?.department_id ?? '') }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const dialogRef = useRef(null);
  const controllerRef = useRef(null);
  const submitting = useRef(false);
  const departmentQuery = useApiQuery(getDepartments, 'category-form-departments');
  const departments = departmentQuery.data || [];
  const departmentsUnavailable = departmentQuery.loading || Boolean(departmentQuery.error) || !departments.length;

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
    if (submitting.current || departmentsUnavailable) return;
    const validationErrors = {};
    if (!values.name.trim()) validationErrors.name = 'Informe o nome da categoria.';
    if (!departments.some((department) => String(department.id) === values.department_id)) {
      validationErrors.department_id = 'Selecione um departamento disponível.';
    }
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
      const payload = { name: values.name.trim(), department_id: Number(values.department_id) };
      if (category) await updateCategory(category.id, payload, controller.signal);
      else await createCategory(filialId, payload, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  return (
    <dialog className="record-dialog" ref={dialogRef} aria-labelledby="category-form-title" aria-describedby="category-form-description"
      onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}>
      <div className="record-dialog-heading">
        <div>
          <h2 id="category-form-title">{category ? 'Editar categoria' : 'Nova categoria'}</h2>
          <p id="category-form-description">{category ? 'Atualize o nome e o departamento da categoria.' : 'Dê um nome à categoria e selecione seu departamento.'}</p>
        </div>
        <button type="button" className="record-dialog-close" aria-label="Fechar cadastro" onClick={onClose} disabled={pending}>×</button>
      </div>
      <form className="record-form" onSubmit={onSubmit} noValidate aria-busy={pending}>
        <p className="record-form-hint">Os campos com * são obrigatórios.</p>
        {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
        {departmentQuery.error && <div className="product-categories-feedback">
          <p className="form-feedback form-feedback-error" role="alert">Não foi possível carregar os departamentos. {departmentQuery.error.message}</p>
          <button type="button" className="secondary-button" onClick={departmentQuery.retry}>Recarregar departamentos</button>
        </div>}
        {!departmentQuery.loading && !departmentQuery.error && !departments.length && <p className="form-feedback form-feedback-error" role="status">Nenhum departamento disponível. Cadastre um departamento para continuar.</p>}
        <fieldset className="record-form-fields" disabled={pending}>
          <div className="record-form-field">
            <label htmlFor="category-name">Nome<span aria-hidden="true"> *</span></label>
            <input id="category-name" name="name" value={values.name} onChange={onChange} placeholder="Nome da categoria" required
              aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'category-name-error' : undefined} />
            {errors.name && <small className="field-error" id="category-name-error">{errors.name}</small>}
          </div>
          <div className="record-form-field">
            <label htmlFor="category-department">Departamento<span aria-hidden="true"> *</span></label>
            <select id="category-department" name="department_id" value={values.department_id} onChange={onChange} required disabled={departmentsUnavailable}
              aria-invalid={Boolean(errors.department_id)} aria-describedby={errors.department_id ? 'category-department-error' : undefined}>
              <option value="">{departmentQuery.loading ? 'Carregando departamentos...' : 'Selecione um departamento'}</option>
              {!departmentsUnavailable && values.department_id && !departments.some((department) => String(department.id) === values.department_id) && <option value={values.department_id} disabled>Departamento indisponível</option>}
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            {errors.department_id && <small className="field-error" id="category-department-error">{errors.department_id}</small>}
          </div>
        </fieldset>
        <div className="record-form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={pending || departmentsUnavailable}>{pending ? 'Salvando...' : category ? 'Salvar alterações' : 'Salvar categoria'}</button>
        </div>
      </form>
    </dialog>
  );
}
