import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { PageLayout } from '../../components/PageLayout';

export function ApHomePage() {
  const { hasPermission } = useAuth();

  const canViewInvoices = hasPermission(PERMISSIONS.AP.INVOICE.VIEW);
  const canCreateInvoice = hasPermission(PERMISSIONS.AP.INVOICE.CREATE);

  const canCreateSupplier = hasPermission(PERMISSIONS.AP.SUPPLIER.CREATE);

  return (
    <PageLayout title="Accounts Payable">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to="/ap/suppliers">Suppliers</Link>
        {canCreateSupplier ? <Link to="/ap/suppliers/new">Create Supplier</Link> : null}
        {canViewInvoices || canCreateInvoice ? <Link to="/ap/invoices">Supplier Invoices</Link> : null}
        {canCreateInvoice ? <Link to="/ap/invoices/new">Create Supplier Invoice</Link> : null}
      </div>
    </PageLayout>
  );
}
