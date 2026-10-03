import type { NextFunction, Request, Response } from 'express';
import { getAuth } from '../config/firebase-admin';
import { AccountDeletion } from '../models/account-deletion.model';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string;
  authTime: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function makeRequireAuth(
  dependencies = {
    auth: getAuth,
    deletionExists: (uid: string) => AccountDeletion.exists({ uid }),
  },
) {
  return async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const header = req.headers.authorization ?? '';
      const match = header.match(/^Bearer (.+)$/i);
      if (!match) {
        res.status(401).json({ error: 'Missing Authorization Bearer token' });
        return;
      }

      const decoded = await dependencies.auth().verifyIdToken(match[1], true);
      const user: AuthenticatedUser = {
        uid: decoded.uid,
        email: decoded.email ?? '',
        displayName: (decoded.name as string | undefined) ?? '',
        authTime: decoded.auth_time ?? 0,
      };
      req.user = user;

      let pendingDeletion;
      try {
        pendingDeletion = await dependencies.deletionExists(user.uid);
      } catch (error) {
        next(error);
        return;
      }
      const retryDeletion =
        req.method === 'DELETE' && req.baseUrl === '/api/me' && req.path === '/';
      if (pendingDeletion && !retryDeletion) {
        res.status(403).json({ error: 'account-deletion-pending' });
        return;
      }

      next();
    } catch (error) {
      console.warn('[auth] token verification failed', (error as Error).message);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
export const requireAuth = makeRequireAuth();
