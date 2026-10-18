/**
 * Safaricom does not publish a fixed list of Daraja callback source IPs and the
 * callbacks are not signed, so entitlements are never granted from a callback
 * alone — the payment is always re-confirmed with an authoritative STK Query.
 * The IP allowlist is therefore optional defense-in-depth for deployments that
 * can pin the source addresses. An empty allowlist disables the check.
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  if (!range || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

/** Parses a comma-separated list of IPs and IPv4 CIDR ranges. */
export function parseIpAllowlist(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Returns true when no allowlist is configured, or when `ip` matches an entry. */
export function isIpAllowed(ip: string | null | undefined, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  const candidate = ip.trim();
  return allowlist.some((entry) => (entry.includes('/') ? matchesCidr(candidate, entry) : entry === candidate));
}
