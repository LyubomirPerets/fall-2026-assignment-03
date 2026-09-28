import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// TODO: Student implementation - Part 1: User Routes
// GET /users
// GET /users/:id
// POST /users

// man wtf is this assignment
router.get('/', async (_req, res, next) => {
    try {
        const users = await db
        .selectFrom('users')
        .selectAll()
        .orderBy('id')
        .execute();

    res.json(users);
    } catch (error) {
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1 || id > MAX_INT) {
            res.sendStatus(404);
            return;
        }

        const user = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();

        if (!user) {
            res.sendStatus(404);
            return;
        }

        res.json(user);
    } catch (error) {
        next(error);
    }
});

function isValidField(value : unknown): value is string {
    return (
        typeof value === 'string' && value.trim() !== '' && value.length <= 255
    );
}

router.post('/', async (req, res, next) => {
    try {
        const { name, email } = req.body;
        if (!isValidField(name) || !isValidField(email)) {
            res.sendStatus(400);
            return;
        }

        const newUser = await db
        .insertInto('users')
        .values({ name: name.trim(), email: email.trim() })
        .returningAll()
        .executeTakeFirst();

    res.status(201).json(newUser); 
    } catch (error) {
        if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    next(error);
    }
});

export default router;
