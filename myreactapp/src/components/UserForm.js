import { useEffect, useRef, useState } from 'react';
import { createUser, getUserCreationOptions } from '../api/resources';
import useApiQuery from '../hooks/useApiQuery';

function validate(values, options) {
  const errors = {};
  const name = values.full_name.trim();
  const username = values.username.trim();
  const email = values.email.trim();
  if (!name || name.length > 120) errors.full_name = 'Informe um nome com até 120 caracteres.';
  if (!/^[A-Za-z0-9._-]{3,60}$/.test(username)) errors.username = 'Use de 3 a 60 letras, números, pontos, hífens ou sublinhados.';
  if (email.length > 160 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Informe um e-mail válido com até 160 caracteres.';
  if (values.password.length < 6 || values.password.length > 72) errors.password = 'A senha deve ter de 6 a 72 caracteres.';
  if (!values.confirm_password || values.confirm_password !== values.password) errors.confirm_password = 'As senhas devem ser iguais.';
  if (!values.group_ids.length || values.group_ids.some((id) => !options.groups.some((group) => group.id === id))) errors.group_ids = 'Selecione pelo menos um perfil disponível.';
  if (!values.filial_ids.length || values.filial_ids.some((id) => !options.filials.some((filial) => filial.id === id))) errors.filial_ids = 'Selecione pelo menos uma filial disponível.';
  return errors;
}

export default function UserForm({ filialId, accessibleFilialIds, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({
    full_name: '', username: '', email: '', password: '', confirm_password: '', group_ids: [],
    filial_ids: accessibleFilialIds.includes(filialId) ? [filialId] : [],
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const dialogRef = useRef(null);
  const controllerRef = useRef(null);
  const submitting = useRef(false);
  const options = useApiQuery((signal) => getUserCreationOptions(accessibleFilialIds, signal), `user-form-options:${accessibleFilialIds.join(',')}`);
  const unavailable = options.loading || Boolean(options.error) || !options.data?.groups.length || !options.data?.filials.length;

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

  const changeValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError('');
  };
  const toggle = (name, id) => changeValue(name, values[name].includes(id) ? values[name].filter((value) => value !== id) : [...values[name], id]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current || unavailable) return;
    const validationErrors = validate(values, options.data);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      const name = Object.keys(validationErrors)[0];
      const field = event.currentTarget.elements.namedItem(name);
      if (field?.focus) field.focus();
      else event.currentTarget.querySelector(`input[name="${name}"]`)?.focus();
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const user = await createUser({
        full_name: values.full_name.trim(), username: values.username.trim(), email: values.email.trim(),
        password: values.password, group_ids: values.group_ids, filial_ids: values.filial_ids,
      }, controller.signal);
      if (!controller.signal.aborted) onSaved(user);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  const field = (name, label, attributes = {}) => <div className="record-form-field">
    <label htmlFor={`user-${name}`}>{label}<span aria-hidden="true"> *</span></label>
    <input id={`user-${name}`} name={name} value={values[name]} onChange={(event) => changeValue(name, event.target.value)} required
      aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `user-${name}-error` : undefined} {...attributes} />
    {errors[name] && <small className="field-error" id={`user-${name}-error`}>{errors[name]}</small>}
  </div>;

  const choices = (name, title, items, label) => <fieldset className="user-options record-form-field-wide" aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `user-${name}-error` : undefined}>
    <legend>{title}<span aria-hidden="true"> *</span></legend>
    {items.map((item) => <label className="user-option" key={item.id} htmlFor={`user-${name}-${item.id}`}>
      <input type="checkbox" id={`user-${name}-${item.id}`} name={name} value={item.id} checked={values[name].includes(item.id)} onChange={() => toggle(name, item.id)} />
      <span>{label(item)}</span>
    </label>)}
    {errors[name] && <small className="field-error" id={`user-${name}-error`}>{errors[name]}</small>}
  </fieldset>;

  return <dialog className="record-dialog" ref={dialogRef} aria-labelledby="user-form-title" aria-describedby="user-form-description"
    onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}>
    <div className="record-dialog-heading"><div><h2 id="user-form-title">Convidar usuário</h2><p id="user-form-description">Crie uma conta e defina os perfis e as filiais de acesso.</p></div><button type="button" className="record-dialog-close" aria-label="Fechar cadastro de usuário" onClick={onClose} disabled={pending}>×</button></div>
    <form className="record-form" onSubmit={onSubmit} noValidate aria-busy={pending || options.loading}>
      <p className="record-form-hint">Os campos com * são obrigatórios. A conta será criada com a senha inicial informada; não há envio de convite por e-mail.</p>
      {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
      {options.loading && <p className="analytics-note" role="status">Carregando perfis e filiais...</p>}
      {options.error && <div className="product-categories-feedback"><p className="form-feedback form-feedback-error" role="alert">Não foi possível carregar os perfis e as filiais. {options.error.message}</p><button type="button" className="secondary-button" onClick={options.retry}>Recarregar opções</button></div>}
      {options.data && (!options.data.groups.length || !options.data.filials.length) && <p className="form-feedback form-feedback-error" role="status">É necessário ter pelo menos um perfil e uma filial acessível para cadastrar um usuário.</p>}
      <fieldset className="record-form-fields" disabled={pending}>
        {field('full_name', 'Nome completo', { autoComplete: 'name', maxLength: 120 })}
        {field('username', 'Login', { autoComplete: 'off', minLength: 3, maxLength: 60, placeholder: 'Ex.: ana.vendas' })}
        {field('email', 'E-mail', { type: 'email', autoComplete: 'email', maxLength: 160 })}
        {field('password', 'Senha inicial', { type: 'password', autoComplete: 'new-password', minLength: 6, maxLength: 72, placeholder: 'De 6 a 72 caracteres' })}
        {field('confirm_password', 'Confirmar senha', { type: 'password', autoComplete: 'new-password', maxLength: 72 })}
        {choices('group_ids', 'Perfis de acesso', options.data?.groups || [], (group) => group.name)}
        {choices('filial_ids', 'Filiais de acesso', options.data?.filials || [], (filial) => `${filial.name}${filial.code ? ` · ${filial.code}` : ''}`)}
      </fieldset>
      <div className="record-form-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button><button type="submit" className="primary-button" disabled={pending || unavailable}>{pending ? 'Cadastrando...' : 'Cadastrar usuário'}</button></div>
    </form>
  </dialog>;
}
