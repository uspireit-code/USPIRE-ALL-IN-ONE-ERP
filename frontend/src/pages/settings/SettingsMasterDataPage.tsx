import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/Card';

export function SettingsMasterDataPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canDepartments = hasPermission('MASTER_DATA_DEPARTMENT_VIEW');
  const canProjects = hasPermission('MASTER_DATA_PROJECT_VIEW');
  const canFunds = hasPermission('MASTER_DATA_FUND_VIEW');

  const NAVY = '#020445';
  const cardBaseShadow = '0 1px 2px rgba(11,12,30,0.06), 0 10px 24px rgba(11,12,30,0.08)';
  const cardHoverShadow = '0 2px 4px rgba(11,12,30,0.08), 0 16px 34px rgba(11,12,30,0.12)';

  const cards: Array<{ key: string; title: string; description: string; to: string; show: boolean; icon: React.ReactNode }> = [
    {
      key: 'departments',
      title: 'Departments',
      description: 'Organisational cost and responsibility units.',
      to: '/settings/master-data/departments',
      show: canDepartments,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-8h6v8" />
        </svg>
      ),
    },
    {
      key: 'projects',
      title: 'Projects',
      description: 'Revenue and cost tracking by engagement or initiative.',
      to: '/settings/master-data/projects',
      show: canProjects,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      ),
    },
    {
      key: 'funds',
      title: 'Funds',
      description: 'Restricted or designated funding sources.',
      to: '/settings/master-data/funds',
      show: canFunds,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1v22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <Link to="/settings">← Back to Settings</Link>
      </div>

      <div
        style={{
          background: '#FFFFFF',
          padding: 24,
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(11,12,30,0.04)',
          border: '1px solid rgba(11,12,30,0.06)',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 750, lineHeight: '32px', color: '#0B0C1E' }}>Master Data</div>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>
          Manage tenant-owned dimensions used across journals, invoices, and reporting.
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {cards
          .filter((c) => c.show)
          .map((c) => (
            <div key={c.key} onClick={() => navigate(c.to)} style={{ cursor: 'pointer' }}>
              <Card
                interactive
                baseShadow={cardBaseShadow}
                hoverShadow={cardHoverShadow}
                baseBorderColor="rgba(2,4,69,0.08)"
                hoverBorderColor="rgba(237,186,53,0.45)"
                style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  minHeight: 180,
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'rgba(2,4,69,0.06)',
                      color: NAVY,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-hidden
                  >
                    {c.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 750, color: NAVY, lineHeight: '22px' }}>{c.title}</div>
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>{c.description}</div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', height: 1, background: 'rgba(11,12,30,0.06)' }} />
                <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.52)' }}>Open</div>
              </Card>
            </div>
          ))}
      </div>
    </div>
  );
}
