import { useNavigate } from 'react-router-dom';
import { createPayment } from '../../services/payments';
import { ApPaymentForm } from './ApPaymentForm';

export function CreateApPaymentPage() {
  const navigate = useNavigate();
  return (
    <ApPaymentForm
      title="Create Supplier Payment"
      submitLabel="Create (DRAFT)"
      onSubmit={async (params) => {
        return createPayment({
          type: 'SUPPLIER_PAYMENT',
          bankAccountId: params.bankAccountId,
          amount: params.amount,
          paymentDate: params.paymentDate,
          reference: params.reference,
          allocations: params.allocations,
        });
      }}
      onSubmitted={(p) => {
        navigate(`/payments/ap/${p.id}`, { replace: true });
      }}
      onCancel={() => navigate('/payments/ap')}
    />
  );
}
