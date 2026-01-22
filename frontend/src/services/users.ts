import { apiFetch } from './api';

export type MyProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  timezone: string | null;
  language: string | null;
  avatarUrl: string | null;
};

export type UpdateMyProfilePayload = {
  fullName?: string;
  phone?: string;
  jobTitle?: string;
  timezone?: string;
  language?: string;
};

export async function getMyProfile(): Promise<MyProfile> {
  return apiFetch<MyProfile>('/users/me', { method: 'GET' });
}

export async function updateMyProfile(payload: UpdateMyProfilePayload): Promise<MyProfile> {
  return apiFetch<MyProfile>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function uploadMyAvatar(file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append('avatar', file);

  return apiFetch<{ avatarUrl: string }>('/users/me/avatar', {
    method: 'POST',
    body: form,
  });
}

export async function changeMyPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/users/me/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
