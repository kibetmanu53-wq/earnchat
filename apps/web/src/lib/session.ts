import { cookies } from 'next/headers';
import { SESSION_COOKIE, getSessionUser } from '@earnchat/auth';
import type { User } from '@earnchat/db';

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}
