export class SecError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = 'SecError';
  }
}

export function userAgentConfigured(value: string | undefined): value is string {
  // The owner supplies a real contact. Do not invent an email or send placeholders.
  return (
    !!value &&
    value.length <= 240 &&
    !/[\r\n]/.test(value) &&
    /\S+\s+.*[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) &&
    !/@(?:example\.(?:com|org|net)|[^\s@]+\.invalid)\b/i.test(value)
  );
}
