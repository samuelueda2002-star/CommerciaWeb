import { useEffect, useId, useRef, useState } from 'react';

export default function DeleteConfirmationDialog({ title, description, warning, onConfirm, onClose, onDeleted }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const controllerRef = useRef(null);
  const submitting = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    cancelRef.current.focus();
    return () => {
      controllerRef.current?.abort();
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      await onConfirm(controller.signal);
      if (!controller.signal.aborted) onDeleted();
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  return (
    <dialog className="record-dialog record-delete-dialog" ref={dialogRef} role="alertdialog"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description ${id}-warning`}
      onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}>
      <div className="record-dialog-heading">
        <div className="record-delete-heading">
          <span className="delete-warning-icon" aria-hidden="true">!</span>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <button type="button" className="record-dialog-close" aria-label="Fechar aviso de exclusão" onClick={onClose} disabled={pending}>×</button>
      </div>
      <p className="record-delete-description" id={`${id}-description`}>{description}</p>
      <p className="record-delete-warning" id={`${id}-warning`}>{warning}</p>
      <form className="record-form" onSubmit={onSubmit} aria-busy={pending}>
        {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
        <div className="record-form-actions">
          <button type="button" className="secondary-button" ref={cancelRef} onClick={onClose} disabled={pending}>Cancelar</button>
          <button type="submit" className="danger-button" disabled={pending}>{pending ? 'Excluindo...' : 'Confirmar exclusão'}</button>
        </div>
      </form>
    </dialog>
  );
}
