export function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

export function decodeMessage(message: string | undefined) {
  if (!message) return '';
  try {
    return decodeURIComponent(message);
  } catch {
    return message;
  }
}

export function mapSupabaseAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) return 'Invalid email or password.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (lower.includes('user already registered')) return 'An account with this email already exists.';
  if (lower.includes('already been registered')) return 'An account with this email already exists.';
  if (lower.includes('password should be at least')) return 'Password must be at least 8 characters.';
  if (lower.includes('too many requests')) return 'Too many attempts. Please wait and try again.';
  if (lower.includes('email rate limit exceeded'))
    return 'Verification email was recently sent. Please check inbox/spam and wait about a minute before retrying.';
  if (lower.includes('requires a valid bearer token'))
    return 'Email service is not configured correctly. Please contact support or check server credentials.';

  return message;
}

export function isRateLimitAuthError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes('rate limit') || lower.includes('too many requests');
}
