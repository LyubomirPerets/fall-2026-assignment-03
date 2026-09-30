import { Router } from 'express';
import { db } from '../db/database.js';
import { sql } from 'kysely';

const router = Router();

const MAX_INT = 2147483647;
// status sets
const TICKET_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
type TicketStatus = (typeof TICKET_STATUSES)[number];

function isTicketStatus(value:unknown): value is TicketStatus {
    return (
        typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value)
    );
}

// parses ID routes , returns null if rows don't match
function parseID(raw: string): number | null {
    if (!/^\d+$/.test(raw)) return null;
    const id = Number(raw);
    if (id < 1 || id > MAX_INT) return null;
    return id;
}

// checks route as a non-negative int
function parseNonNegativeInt(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

// checks if value is not null or array
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// rejects bodies containing any field not in allowed list
function hasOnlyKeys(obj: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(obj).every((key) => allowed.includes(key));
}


function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String(err.code);
  }
  return undefined;
}

// TODO: Student implementation - Part 1: Ticket Routes
// GET /tickets
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset, status } = req.query;
 
    // Order by id so pagination is stable across requests
    let query = db.selectFrom('tickets').selectAll().orderBy('id');
 
    if (status !== undefined) {
      if (!isTicketStatus(status)) {
        res.status(400).json({
          error: `status must be one of: ${TICKET_STATUSES.join(', ')}`,
        });
        return;
      }
      query = query.where('status', '=', status);
    }
 
    if (limit !== undefined) {
      const n = parseNonNegativeInt(limit);
      if (n === null || n < 1) {
        res.status(400).json({ error: 'limit must be a positive integer' });
        return;
      }
      query = query.limit(n);
    }
 
    if (offset !== undefined) {
      const n = parseNonNegativeInt(offset);
      if (n === null) {
        res.status(400).json({ error: 'offset must be a non-negative integer' });
        return;
      }
      query = query.offset(n);
    }
 
    res.json(await query.execute());
  } catch (err) {
    next(err);
  }
});
// GET /tickets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.sendStatus(404);
      return;
    }
 
    const ticket = await db
      .selectFrom('tickets')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
 
    if (!ticket) {
      res.sendStatus(404);
      return;
    }
 
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});
// POST /tickets

router.post('/', async (req, res, next) => {
  try {
    const body: unknown = req.body;
 
    if (!isPlainObject(body) || !hasOnlyKeys(body, ['title', 'description'])) {
      res.status(400).json({
        error: 'Body must be an object with only title and description',
      });
      return;
    }
 
    const { title, description } = body;
 
    if (typeof title !== 'string' || title.trim() === '' || title.length > 255) {
      res.status(400).json({
        error: 'title is required and must be a non-empty string of at most 255 characters',
      });
      return;
    }
 
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== 'string'
    ) {
      res.status(400).json({ error: 'description must be a string or null' });
      return;
    }

   // Set by authMiddleware from the X-User-Id header
    const creatorId: unknown = res.locals.userId;
    if (typeof creatorId !== 'number') {
      res.sendStatus(401);
      return;
    }
    if (creatorId > MAX_INT) {
      res.status(400).json({ error: 'Creator user does not exist' });
      return;
    }
 
    const ticket = await db
      .insertInto('tickets')
      .values({
        title,
        description: description ?? null,
        creator_id: creatorId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
 
    res.status(201).json(ticket);
  } catch (err) {
    // 23503: foreign key violation (X-User-Id doesn't match an existing user)
    if (pgErrorCode(err) === '23503') {
      res.status(400).json({ error: 'Creator user does not exist' });
      return;
    }
    next(err);
  }
});

// PATCH /tickets/:id/status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.sendStatus(404);
      return;
    }
 
    const body: unknown = req.body;
 
    if (!isPlainObject(body) || !hasOnlyKeys(body, ['status'])) {
      res.status(400).json({ error: 'Body must be an object with only status' });
      return;
    }
 
    if (!isTicketStatus(body.status)) {
      res.status(400).json({
        error: `status must be one of: ${TICKET_STATUSES.join(', ')}`,
      });
      return;
    }
 
    const ticket = await db
      .updateTable('tickets')
      .set({ status: body.status, updated_at: sql`CURRENT_TIMESTAMP` })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
 
    if (!ticket) {
      res.sendStatus(404);
      return;
    }
 
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});
// TODO: Student implementation - Part 2: Time Log Routes
// POST /tickets/:id/time
// GET /tickets/:id/time


export default router;
