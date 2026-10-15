import type { User } from '@earnchat/db';

/** Strips sensitive fields before sending a user to the client. */
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    verified: user.verified,
    membershipPlan: user.membershipPlan
  };
}
