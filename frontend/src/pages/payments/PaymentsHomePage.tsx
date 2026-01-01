import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';

export function PaymentsHomePage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission('PAYMENT_VIEW');
  const canCreate = hasPermission('PAYMENT_CREATE');

  return (
    <PageLayout title="Payments" description="Payments lifecycle in the backend is DRAFT → APPROVED → POSTED.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to="/payments/bank-accounts">Bank Accounts</Link>
        {canView ? <Link to="/payments/ap">Supplier Payments</Link> : null}
        {canCreate ? <Link to="/payments/ap/new">Create Supplier Payment</Link> : null}
        {canView ? <Link to="/payments/ar">Customer Receipts</Link> : null}
        {canCreate ? <Link to="/payments/ar/new">Create Customer Receipt</Link> : null}
      </div>
    </PageLayout>
  );
}
