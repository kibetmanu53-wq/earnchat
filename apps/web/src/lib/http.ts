import { NextResponse } from 'next/server';
import { AppError } from '@earnchat/core';
import { logger } from '@earnchat/logger';
import { MpesaError } from '@earnchat/payments';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  // Payment provider misconfiguration and provider/network failures are
  // operational problems, not crashes: report them with the actionable message
  // the provider layer already built instead of a generic 500.
  if (error instanceof MpesaError) {
    const status = error.code === 'not_configured' ? 500 : 502;
    logger.error('Payment provider error', { code: error.code, message: error.message });
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status, headers: { 'cache-control': 'no-store' } }
    );
  }
  if (error instanceof Error && error.message.startsWith('DATABASE_URL is not set')) {
    logger.error('DATABASE_URL is not set for this environment');
    return NextResponse.json(
      {
        error: 'The server is not connected to a database. Set DATABASE_URL for this environment.',
        code: 'database_not_configured'
      },
      { status: 500 }
    );
  }
  logger.error('Unhandled API error', { error });
  return NextResponse.json({ error: 'The server could not complete this request.' }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    throw new AppError('Invalid JSON body.', 400, 'invalid_json');
  }
}
