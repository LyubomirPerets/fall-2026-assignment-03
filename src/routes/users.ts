import { Router } from 'express';
import { getAllUsers, getUserById, createUser } from '../dal/users.js';
 
const router = Router();
 
// Largest value a Postgres integer column can hold
const MAX_INT = 2147483647;
 
// Checks for a non-empty string that fits in a varchar(255) column
function isValidField(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim() !== '' && value.length <= 255
  );
}
 
// Part 1: User Routes
 
// GET /users
router.get('/', async (_req, res, next) => {
  try {
    res.json(await getAllUsers());
  } catch (err) {
    next(err);
  }
});
 
// GET /users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
 
    // Non-numeric or out-of-range IDs can't match a user, so treat them as not found
    if (!Number.isInteger(id) || id < 1 || id > MAX_INT) {
      res.sendStatus(404);
      return;
    }
 
    const user = await getUserById(id);
    if (!user) {
      res.sendStatus(404);
      return;
    }
 
    res.json(user);
  } catch (err) {
    next(err);
  }
});
 
// POST /users
router.post('/', async (req, res, next) => {
  try {
    const { name, email } = req.body ?? {};
 
    if (!isValidField(name) || !isValidField(email)) {
      res
        .status(400)
        .json({ error: 'name and email are required non-empty strings' });
      return;
    }
 
    const user = await createUser({ name, email });
    res.status(201).json(user);
  } catch (err) {
    // 23505 is Postgres's code for a unique constraint violation (duplicate email)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === '23505'
    ) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    next(err);
  }
});
 
export default router;