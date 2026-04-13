export const PASSWORD_MIN_LENGTH = 8;

export const getPasswordChecks = (password: string) => ({
  minLength: password.length >= PASSWORD_MIN_LENGTH,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /\d/.test(password),
});

export const getPasswordValidationMessage = (password: string) => {
  const checks = getPasswordChecks(password);

  if (!checks.minLength) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (!checks.uppercase) {
    return "Password must include at least one uppercase letter.";
  }

  if (!checks.lowercase) {
    return "Password must include at least one lowercase letter.";
  }

  if (!checks.number) {
    return "Password must include at least one number.";
  }

  return null;
};
