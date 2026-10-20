import { useEffect, useRef, useState } from 'react';
import { createClient, updateClient } from '../api/resources';

function formatCpf(value) {
  return value.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validate(values) {
  const errors = {};
  if (!values.first_name.trim()) errors.first_name = 'Informe o nome do cliente.';
  if (!values.last_name.trim()) errors.last_name = 'Informe o sobrenome do cliente.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Informe um e-mail válido.';
  if (!/^\d{11}$/.test(values.cpf.replace(/[.\-\s]/g, ''))) errors.cpf = 'Informe um CPF com 11 dígitos.';
  return errors;
}

export default function ClientForm({ filialId, client = null, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({
    first_name: client?.first_name ?? '',
    last_name: client?.last_name ?? '',
    email: client?.email ?? '',
    cpf: formatCpf(client?.cpf ?? ''),
    phone: client?.phone ?? '',
    birth_date: client?.birth_date ?? '',
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const dialogRef = useRef(null);
  const controllerRef = useRef(null);
  const submitting = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector('input').focus();
    return () => {
      controllerRef.current?.abort();
      dialog.close();
    };
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: name === 'cpf' ? formatCpf(value) : value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const validationErrors = validate(values);
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
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        cpf: values.cpf.replace(/[.\-\s]/g, ''),
        phone: values.phone.trim() || null,
        birth_date: values.birth_date || null,
      };
      if (client) {
        await updateClient(client.id, payload, controller.signal);
      } else {
        await createClient(filialId, payload, controller.signal);
      }
      if (!controller.signal.aborted) onSaved();
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  const field = (name, label, options = {}) => (
    <div className="record-form-field">
      <label htmlFor={`client-${name}`}>{label}{options.required && <span aria-hidden="true"> *</span>}</label>
      <input
        id={`client-${name}`}
        name={name}
        value={values[name]}
        onChange={onChange}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `client-${name}-error` : undefined}
        {...options}
      />
      {errors[name] && <small className="field-error" id={`client-${name}-error`}>{errors[name]}</small>}
    </div>
  );

  return (
    <dialog
      className="record-dialog"
      ref={dialogRef}
      aria-labelledby="record-form-title"
      aria-describedby="record-form-description"
      onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}
    >
      <div className="record-dialog-heading">
        <div>
          <h2 id="record-form-title">{client ? 'Editar cliente' : 'Novo cliente'}</h2>
          <p id="record-form-description">{client ? 'Atualize os dados do cliente e salve as alterações.' : 'Preencha os dados para adicionar um cliente à sua base.'}</p>
        </div>
        <button type="button" className="record-dialog-close" aria-label="Fechar cadastro" onClick={onClose} disabled={pending}>×</button>
      </div>
      <form className="record-form" onSubmit={onSubmit} noValidate aria-busy={pending}>
        <p className="record-form-hint">Os campos com * são obrigatórios.</p>
        {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
        <fieldset className="record-form-fields" disabled={pending}>
          {field('first_name', 'Nome', { required: true, autoComplete: 'given-name', placeholder: 'Nome do cliente' })}
          {field('last_name', 'Sobrenome', { required: true, autoComplete: 'family-name', placeholder: 'Sobrenome do cliente' })}
          {field('email', 'E-mail', { required: true, type: 'email', autoComplete: 'email', placeholder: 'cliente@exemplo.com' })}
          {field('cpf', 'CPF', { required: true, inputMode: 'numeric', placeholder: '000.000.000-00', maxLength: 14 })}
          {field('phone', 'Telefone (opcional)', { type: 'tel', autoComplete: 'tel', placeholder: '(11) 99999-9999' })}
          {field('birth_date', 'Data de nascimento (opcional)', { type: 'date', autoComplete: 'bday' })}
        </fieldset>
        <div className="record-form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={pending}>{pending ? 'Salvando...' : client ? 'Salvar alterações' : 'Salvar cliente'}</button>
        </div>
      </form>
    </dialog>
  );
}
