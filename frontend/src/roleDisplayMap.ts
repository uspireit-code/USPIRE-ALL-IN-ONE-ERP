export type RoleCategory =
  | 'System Administration'
  | 'Finance Operations'
  | 'Planning & Forecasting'
  | 'Audit & Oversight'
  | 'Other';

export type RoleDisplayInfo = {
  label: string;
  description: string;
  category: RoleCategory;
};

export const roleDisplayMap: Record<string, RoleDisplayInfo> = {
  ADMIN: {
    label: 'System Administrator',
    description: 'Manages users, roles, and system settings. No operational accounting actions.',
    category: 'System Administration',
  },
  FINANCE_OFFICER: {
    label: 'Finance Officer',
    description: 'Prepares and posts accounting transactions but cannot approve.',
    category: 'Finance Operations',
  },
  FINANCE_CONTROLLER: {
    label: 'Finance Controller',
    description: 'Posts items in the post queue. Cannot create or review journals (SoD enforced).',
    category: 'Finance Operations',
  },
  FINANCE_MANAGER: {
    label: 'Finance Manager',
    description: 'Reviews journals and posts/reverses them. Cannot create or edit journals (SoD enforced).',
    category: 'Finance Operations',
  },
  AUDITOR: {
    label: 'Auditor',
    description: 'Read-only access to reports, audit trail, and financial statements.',
    category: 'Audit & Oversight',
  },
  FORECAST_MAKER: {
    label: 'Forecast Preparer',
    description: 'Creates and edits forecasts but cannot approve them.',
    category: 'Planning & Forecasting',
  },
  FORECAST_APPROVER: {
    label: 'Forecast Approver',
    description: 'Reviews and approves forecasts (maker-checker enforced).',
    category: 'Planning & Forecasting',
  },
};

export function getRoleDisplayInfo(internalRoleCode: string | null | undefined): RoleDisplayInfo {
  if (!internalRoleCode) {
    return {
      label: 'Role',
      description: 'Additional role.',
      category: 'Other',
    };
  }

  return (
    roleDisplayMap[internalRoleCode] ?? {
      label: 'Additional role',
      description: 'A specialised system role. Contact an administrator for details.',
      category: 'Other',
    }
  );
}
