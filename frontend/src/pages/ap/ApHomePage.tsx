import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { PageLayout } from '../../components/PageLayout';

export function ApHomePage() {
  const { hasPermission } = useAuth();

  const canViewBills = hasPermission(PERMISSIONS.AP.INVOICE_VIEW);
  const canCreateBill = hasPermission(PERMISSIONS.AP.INVOICE_CREATE);

  const canCreateSupplier = hasPermission(PERMISSIONS.AP.SUPPLIER_CREATE);

  return (
    <PageLayout title="Accounts Payable">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to="/ap/suppliers">Suppliers</Link>
        {canCreateSupplier ? <Link to="/ap/suppliers/new">Create Supplier</Link> : null}
        {canViewBills || canCreateBill ? <Link to="/ap/bills">Bills</Link> : null}
        {canCreateBill ? <Link to="/ap/bills/new">Create Bill</Link> : null}
      </div>
    </PageLayout>
  );
}
