import { useEffect, useState } from 'react';
import { type Customer } from '../services/ar';
import { apiFetch } from '../services/api';
import { listCustomers } from '../services/ar';

export function useCustomers(params?: {
  enabled?: boolean;
  source?: 'finance' | 'statements';
}) {
  const enabled = params?.enabled ?? true;
  const source = params?.source ?? 'finance';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    setIsLoading(true);
    setError(null);

    const load =
      source === 'statements'
        ? apiFetch<{ items: Customer[] }>('/ar/statements/customers', {
            method: 'GET',
          })
        : listCustomers({ page: 1, pageSize: 500 });

    Promise.resolve(load)
      .then((resp: any) => {
        if (!mounted) return;
        const items = (resp as any)?.items ?? [];
        setCustomers(items);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e);
        setCustomers([]);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [enabled, source]);

  return { customers, isLoading, error };
}
