import { getDashboard } from '@earnchat/core';
import { jsonError, jsonOk } from '@/lib/http';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonOk({ user: null });
    return jsonOk({ user: await getDashboard(user) });
  } catch (error) {
    return jsonError(error);
  }
}
