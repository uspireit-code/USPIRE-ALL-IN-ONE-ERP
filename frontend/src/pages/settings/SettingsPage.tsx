import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { useAuth } from '../../auth/AuthContext';

export function SettingsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const NAVY = '#020445';

  const cardBaseShadow = '0 1px 2px rgba(11,12,30,0.06), 0 10px 24px rgba(11,12,30,0.08)';
  const cardHoverShadow = '0 2px 4px rgba(11,12,30,0.08), 0 16px 34px rgba(11,12,30,0.12)';

  const sections: Array<{ key: string; title: string; description: string; to: string; icon: React.ReactNode }> = [
    {
      key: 'org',
      title: 'Organisation & Branding',
      description: 'Manage organisation information, branding, and identity.',
      to: '/settings/organisation',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-8h6v8" />
        </svg>
      ),
    },
    {
      key: 'users',
      title: 'Users',
      description: 'Create and manage system users and access.',
      to: '/settings/users',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21a8 8 0 1 0-16 0" />
          <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        </svg>
      ),
    },
    {
      key: 'roles',
      title: 'Roles & Permissions',
      description: 'Define roles, permissions, and segregation of duties.',
      to: '/settings/roles',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      key: 'system',
      title: 'System Configuration',
      description: 'System configuration, environment details, and security settings.',
      to: '/settings/system',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.93 19.07l1.41-1.41" />
          <path d="M17.66 6.34l1.41-1.41" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ),
    },
    ...(hasPermission('MASTER_DATA_DEPARTMENT_VIEW') ||
    hasPermission('MASTER_DATA_PROJECT_VIEW') ||
    hasPermission('MASTER_DATA_FUND_VIEW')
      ? [
          {
            key: 'master-data',
            title: 'Master Data',
            description: 'Manage Departments, Projects, and Funds for this tenant.',
            to: '/settings/master-data',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
              </svg>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div
        style={{
          background: '#FFFFFF',
          padding: 32,
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(11,12,30,0.04)',
          border: '1px solid rgba(11,12,30,0.06)',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 750, lineHeight: '32px', color: '#0B0C1E' }}>Settings</div>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>
          Manage organisation details, users, access control, and system configuration.
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
        {sections.map((section) => (
          <div key={section.key} onClick={() => navigate(section.to)} style={{ cursor: 'pointer' }}>
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
                  {section.icon}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 750, color: NAVY, lineHeight: '22px' }}>{section.title}</div>
                  <div style={{ marginTop: 6, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>{section.description}</div>
                </div>
              </div>

              <div style={{ marginTop: 'auto', height: 1, background: 'rgba(11,12,30,0.06)' }} />
              <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.52)' }}>Configure this area in the next step.</div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
