import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/index';

describe('logger', () => {
  it('emits JSON with level, message and merged fields in production', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ service: 'test' }, { NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    logger.info('hello', { userId: 'u1' });

    expect(log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({ level: 'info', msg: 'hello', service: 'test', userId: 'u1' });
    log.mockRestore();
  });

  it('filters out events below the configured level', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({}, { LOG_LEVEL: 'warn', NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    logger.info('ignored');

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('child loggers inherit the base fields', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger({ service: 'web' }, { NODE_ENV: 'production' }).child({ requestId: 'r1' });
    logger.error('boom');

    const payload = JSON.parse(String(err.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({ level: 'error', service: 'web', requestId: 'r1' });
    err.mockRestore();
  });
});
