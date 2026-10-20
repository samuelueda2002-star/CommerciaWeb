import { deleteClient } from '../api/resources';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

export default function ClientDeleteDialog({ client, onClose, onDeleted }) {
  const name = `${client.first_name} ${client.last_name}`.trim();
  return (
    <DeleteConfirmationDialog
      title="Excluir cliente?"
      description={<>Deseja excluir <strong>{name}</strong> (E-mail: {client.email})?</>}
      warning="Ao confirmar, o cliente ficará inativo. O cadastro e o histórico de pedidos serão preservados."
      onConfirm={(signal) => deleteClient(client.id, signal)}
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}
