import { requestPasswordReset } from '@earnchat/core';
import { emailOnlySchema } from '@earnchat/validation';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'forgot-password', 5, 15 * 60_000);

    const parsed = emailOnlySchema.safeParse(await readJson(request));
    if (parsed.success) {
      // Never reveal whether the address exists; log send failures instead.
      try {
        await requestPasswordReset(parsed.data.email);
      } catch (error) {
        console.error('Password reset email failed:', error);
      }
    }

    return jsonOk({ ok: true, message: 'If an account exists for that email, a reset link is on its way.' });
  } catch (error) {
    return jsonError(error);
  }
}
