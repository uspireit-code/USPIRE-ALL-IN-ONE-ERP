import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';

export function ArHomePage() {
  const { hasPermission } = useAuth();

  const canViewInvoices = hasPermission('INVOICE_VIEW');
  const canCreateInvoice = hasPermission('INVOICE_CREATE');

  const canCreateCustomer = hasPermission('AR_CUSTOMER_CREATE');

  return (
    <PageLayout title="Accounts Receivable">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to="/ar/customers">Customers</Link>
        {canCreateCustomer ? <Link to="/ar/customers/new">Create Customer</Link> : null}
        {canViewInvoices || canCreateInvoice ? <Link to="/ar/invoices">Customer Invoices</Link> : null}
        {canCreateInvoice ? <Link to="/ar/invoices/new">Create Customer Invoice</Link> : null}
      </div>
    </PageLayout>
  );
}
