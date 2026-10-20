import { deleteProduct } from '../api/resources';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

export default function ProductDeleteDialog({ product, onClose, onDeleted }) {
  return (
    <DeleteConfirmationDialog
      title="Excluir produto?"
      description={<>Deseja excluir <strong>{product.name}</strong> (SKU: {product.sku})?</>}
      warning="Ao confirmar, o produto ficará inativo. O cadastro e o histórico de vendas serão preservados."
      onConfirm={(signal) => deleteProduct(product.id, signal)}
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}
