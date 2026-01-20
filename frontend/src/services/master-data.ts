import { apiFetch } from './api';

export type MasterStatus = 'ACTIVE' | 'INACTIVE';
export type ProjectStatus = 'ACTIVE' | 'CLOSED';

export type Department = {
  id: string;
  code: string;
  name: string;
  status: MasterStatus;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentMember = {
  id: string;
  userId: string;
  status: MasterStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; isActive: boolean };
};

export type Project = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  isRestricted: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Fund = {
  id: string;
  code: string;
  name: string;
  projectId: string | null;
  status: MasterStatus;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listDepartments() {
  return apiFetch<Department[]>('/master-data/departments', { method: 'GET' });
}

export async function createDepartment(params: {
  code: string;
  name: string;
  status?: MasterStatus;
  isActive?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}) {
  return apiFetch<Department>('/master-data/departments', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateDepartment(id: string, params: Partial<Omit<Department, 'id' | 'createdAt' | 'updatedAt'>> & { effectiveFrom?: string; effectiveTo?: string | null }) {
  return apiFetch<Department>(`/master-data/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export async function listDepartmentMembers(departmentId: string) {
  return apiFetch<DepartmentMember[]>(`/master-data/departments/${departmentId}/members`, { method: 'GET' });
}

export async function addDepartmentMember(departmentId: string, params: { userId: string; effectiveFrom?: string; effectiveTo?: string }) {
  return apiFetch<{ id: string }>(`/master-data/departments/${departmentId}/members`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateDepartmentMemberStatus(departmentId: string, userId: string, params: { isActive: boolean; effectiveFrom?: string; effectiveTo?: string | null }) {
  return apiFetch<{ id: string }>(`/master-data/departments/${departmentId}/members/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export async function listProjects() {
  return apiFetch<Project[]>('/master-data/projects', { method: 'GET' });
}

export async function createProject(params: {
  code: string;
  name: string;
  status?: ProjectStatus;
  isRestricted?: boolean;
  isActive?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}) {
  return apiFetch<Project>('/master-data/projects', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateProject(id: string, params: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> & { effectiveFrom?: string; effectiveTo?: string | null }) {
  return apiFetch<Project>(`/master-data/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export async function closeProject(id: string) {
  return apiFetch<Project>(`/master-data/projects/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function listFunds() {
  return apiFetch<Fund[]>('/master-data/funds', { method: 'GET' });
}

export async function createFund(params: {
  code: string;
  name: string;
  projectId?: string;
  status?: MasterStatus;
  isActive?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}) {
  return apiFetch<Fund>('/master-data/funds', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateFund(id: string, params: Partial<Omit<Fund, 'id' | 'createdAt' | 'updatedAt'>> & { effectiveFrom?: string; effectiveTo?: string | null }) {
  return apiFetch<Fund>(`/master-data/funds/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}
