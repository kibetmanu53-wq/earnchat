import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { creditEligibleChat } from '@earnchat/core';
import { eligibleChatSchema } from '@earnchat/validation';
import { jsonError, jsonOk, readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Trusted server-to-server endpoint that credits eligible-chat earnings. */
export async function POST(request: Request) {
  try {
    const secret = process.env.EARNINGS_ADMIN_SECRET ?? '';
    if (secret.length < 32) {
      return NextResponse.json({ error: 'Eligible-chat crediting is not configured.' }, { status: 503 });
    }
    if (!safeEqual(request.headers.get('x-earnings-admin-secret') ?? '', secret)) {
      return NextResponse.json({ error: 'Unauthorized earnings event.' }, { status: 401 });
    }

    const parsed = eligibleChatSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Provide a completed five-minute chat with distinct valid account IDs.' },
        { status: 400 }
      );
    }

    const result = await creditEligibleChat(parsed.data);
    return jsonOk(result, 201);
  } catch (error) {
    return jsonError(error);
  }
}
