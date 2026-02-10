export function validatePasswordComplexity(password: string): {
  valid: boolean;
  message?: string;
} {
  const value = String(password ?? '');

  const minLength = value.length >= 10;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecial = /[^A-Za-z0-9]/.test(value);

  const valid = minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  if (valid) return { valid: true };

  return {
    valid: false,
    message:
      'Password must be at least 10 characters and include uppercase, lowercase, number, and special character.',
  };
}
