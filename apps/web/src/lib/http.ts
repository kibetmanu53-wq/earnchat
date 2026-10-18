import { NextResponse } from 'next/server';
import { AppError } from '@earnchat/core';
import { logger } from '@earnchat/logger';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
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
