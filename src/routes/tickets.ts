import { Router } from 'express';
import {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
} from '../dal/tickets.js';
import { insertTimeLog, getTotalHoursForTicket } from '../dal/timeLogs.js';

const router = Router();
const MAX_INT = 2147483647;
const TICKET_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
type TicketStatus = (typeof TICKET_STATUSES)[number];

// validation helpers

function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    typeof value === 'string' &&
    (TICKET_STATUSES as readonly string[]).includes(value)
  );
}

// Parses a route ID; returns null if it can't match a row
function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_INT ? id : null;
}

// Parses a query parameter as a non-negative integer; null if invalid
function parseNonNegativeInt(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Rejects bodies containing any field not in the allowed list
function hasOnlyKeys(obj: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(obj).every((key) => allowed.includes(key));
}

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String(err.code);
  }
  return undefined;
}

// pt 1 ticket routes

// GET /tickets?limit=10&offset=0&status=TODO
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset, status } = req.query;
    const options: { limit?: number; offset?: number; status?: string } = {};

    if (status !== undefined) {
      if (!isTicketStatus(status)) {
        res.status(400).json({
          error: `status must be one of: ${TICKET_STATUSES.join(', ')}`,
        });
        return;
      }
      options.status = status;
    }

    if (limit !== undefined) {
      const n = parseNonNegativeInt(limit);
      if (n === null || n < 1) {
        res.status(400).json({ error: 'limit must be a positive integer' });
        return;
      }
      options.limit = n;
    }

    if (offset !== undefined) {
      const n = parseNonNegativeInt(offset);
      if (n === null) {
        res.status(400).json({ error: 'offset must be a non-negative integer' });
        return;
      }
      options.offset = n;
    }

    res.json(await getAllTickets(options));
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

    const ticket = await getTicketById(id);
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

    const ticket = await createTicket({
      title,
      description: description ?? null,
      creator_id: creatorId,
    });

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

    const ticket = await updateTicketStatus(id, body.status);
    if (!ticket) {
      res.sendStatus(404);
      return;
    }

    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// pt2 time log routes

// POST /tickets/:id/time
router.post('/:id/time', async (req, res, next) => {
  try {
    const ticketId = parseId(req.params.id);
    if (ticketId === null) {
      res.sendStatus(404);
      return;
    }

    const body: unknown = req.body;

    if (!isPlainObject(body) || !hasOnlyKeys(body, ['hours'])) {
      res.status(400).json({ error: 'Body must be an object with only hours' });
      return;
    }

    // hours is stored in an integer column, so require a positive whole number
    const { hours } = body;
    if (
      typeof hours !== 'number' ||
      !Number.isInteger(hours) ||
      hours < 1 ||
      hours > MAX_INT
    ) {
      res.status(400).json({ error: 'hours must be a positive whole number' });
      return;
    }

    // Set by authMiddleware from the X-User-Id header
    const userId: unknown = res.locals.userId;
    if (typeof userId !== 'number') {
      res.sendStatus(401);
      return;
    }
    if (userId > MAX_INT) {
      res.status(400).json({ error: 'User does not exist' });
      return;
    }

    if (!(await getTicketById(ticketId))) {
      res.sendStatus(404);
      return;
    }

    const timeLog = await insertTimeLog(ticketId, userId, hours);
    res.status(201).json(timeLog);
  } catch (err) {
    // 23503: foreign key violation. The ticket was checked above, so this is the user.
    if (pgErrorCode(err) === '23503') {
      res.status(400).json({ error: 'User does not exist' });
      return;
    }
    next(err);
  }
});

// GET /tickets/:id/time
router.get('/:id/time', async (req, res, next) => {
  try {
    const ticketId = parseId(req.params.id);
    if (ticketId === null) {
      res.sendStatus(404);
      return;
    }

    if (!(await getTicketById(ticketId))) {
      res.sendStatus(404);
      return;
    }

    const totalHours = await getTotalHoursForTicket(ticketId);
    res.json({ ticket_id: ticketId, total_hours: totalHours });
  } catch (err) {
    next(err);
  }
});

export default router;