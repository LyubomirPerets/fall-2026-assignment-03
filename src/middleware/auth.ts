import { Request, Response, NextFunction } from 'express';

const PROTECTED_METHODS = new Set(['POST', 'PATCH']);

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Part 1: Authentication Middleware
  // Store the authenticated userId on res.locals.userId

  if (!PROTECTED_METHODS.has(req.method)) {
    next();
    return;
  }

  const raw = req.get('X-User-Id')?.trim() ?? '';
  const userId = Number(raw);

  if (raw === '' || isNaN(userId) || userId <= 0) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.locals.userId = userId;
  next();
}

export default authMiddleware;