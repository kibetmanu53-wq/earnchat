import { NextResponse } from 'next/server';
import { AppError, authenticate } from '@earnchat/core';
import { loginSchema } from '@earnchat/validation';
import { SESSION_COOKIE, SESSION_TTL_MS, createSession } from '@earnchat/auth';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { publicUser } from '@/lib/serialize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'login', 20, 15 * 60_000);
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) throw new AppError('Email or password is incorrect.', 401, 'invalid_credentials');
    const session = await createSession(user.id);
    const response = jsonOk({ user: publicUser(user) });
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
