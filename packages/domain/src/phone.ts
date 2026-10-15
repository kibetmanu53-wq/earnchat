/**
 * Normalizes a Kenyan mobile number to the 2547XXXXXXXX / 2541XXXXXXXX form
 * expected by Safaricom Daraja. Returns null when the input is not a valid
 * Kenyan M-Pesa number.
 */
export function normalizeKenyanPhone(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  const phone = digits.startsWith('0')
    ? '254' + digits.slice(1)
    : digits.startsWith('7') || digits.startsWith('1')
      ? '254' + digits
      : digits;
  return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

/** Masks a normalized phone for display, e.g. 2547****5678. */
export function maskPhone(phone: string): string {
  return phone.length >= 6 ? `${phone.slice(0, 4)}****${phone.slice(-4)}` : phone;
}
