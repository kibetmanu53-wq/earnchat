import { NextResponse } from 'next/server';
import { createAccount } from '@earnchat/core';
import { registerSchema } from '@earnchat/validation';
import { SESSION_COOKIE, SESSION_TTL_MS, createSession } from '@earnchat/auth';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { publicUser } from '@/lib/serialize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'register', 10, 15 * 60_000);
    const parsed = registerSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, { status: 400 });
    }
    const user = await createAccount(parsed.data);
    const session = await createSession(user.id);
    const response = jsonOk({ user: publicUser(user) }, 201);
    response.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      secure: process.env.NODE_ENV === 'production'
    });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
