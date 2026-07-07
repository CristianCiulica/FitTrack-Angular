import type { NextFunction, Request, Response } from 'express';
import { getAuth } from '../config/firebase-admin';
import { UserProfile } from '../models/user-profile.model';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const match = header.match(/^Bearer (.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Missing Authorization Bearer token' });
      return;
    }

    const decoded = await getAuth().verifyIdToken(match[1]);
    const user: AuthenticatedUser = {
      uid: decoded.uid,
      email: decoded.email ?? '',
      displayName: (decoded.name as string | undefined) ?? '',
    };
    req.user = user;

    await UserProfile.updateOne(
      { uid: user.uid },
      {
        $setOnInsert: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        },
      },
      { upsert: true },
    );

    next();
  } catch (error) {
    console.warn('[auth] token verification failed', (error as Error).message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
