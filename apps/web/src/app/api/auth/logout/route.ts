import { cookies } from 'next/headers';
import { SESSION_COOKIE, destroySession } from '@earnchat/auth';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const store = await cookies();
    await destroySession(store.get(SESSION_COOKIE)?.value);
    const response = jsonOk({ ok: true });
    response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
