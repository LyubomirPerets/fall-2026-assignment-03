import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

    // TODO: Student implementation - Part 1: Integration Testing

    async function createUser (name = 'Alice', email = 'alice@example.com') {
      const res = await request(app)
        .post('/users')
        .set('X-User-Id', '1')
        .send({ name, email });
      expect(res.status).toBe(201);
      return res.body as { id: number; name: string; email: string };
    }

    async function createTicket(userId: number, title: string, description?: string) {
  const res = await request(app)
    .post('/tickets')
    .set('X-User-Id', String(userId))
    .send({ title, description });
  expect(res.status).toBe(201);
  return res.body as { id: number; title: string; status: string };
}
 
describe('Part 1: API Integration Tests', () => {
  describe('Users', () => {
    it('creates a user and returns 201', async () => {
      const res = await request(app)
        .post('/users')
        .set('X-User-Id', '1')
        .send({ name: 'Alice', email: 'alice@example.com' });
 
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
      expect(res.body.id).toEqual(expect.any(Number));
    });
 
    it('returns all users', async () => {
      await createUser('Alice', 'alice@example.com');
      await createUser('Bob', 'bob@example.com');
 
      const res = await request(app).get('/users');
 
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
 
    it('returns a single user by id', async () => {
      const user = await createUser();
 
      const res = await request(app).get(`/users/${user.id}`);
 
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: user.id, name: 'Alice' });
    });
 
    it('returns 404 for a non-existent user', async () => {
      const res = await request(app).get('/users/999');
      expect(res.status).toBe(404);
    });
 
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/users')
        .set('X-User-Id', '1')
        .send({ name: 'No Email' });
 
      expect(res.status).toBe(400);
    });
 
    it('returns 409 for a duplicate email', async () => {
      await createUser('Alice', 'alice@example.com');
 
      const res = await request(app)
        .post('/users')
        .set('X-User-Id', '1')
        .send({ name: 'Alice Again', email: 'alice@example.com' });
 
      expect(res.status).toBe(409);
    });
  });
 
  describe('Auth middleware', () => {
    it('returns 401 when X-User-Id is missing on POST', async () => {
      const res = await request(app)
        .post('/users')
        .send({ name: 'Alice', email: 'alice@example.com' });
 
      expect(res.status).toBe(401);
    });
 
    it('returns 401 when X-User-Id is not a valid number', async () => {
      const res = await request(app)
        .post('/tickets')
        .set('X-User-Id', 'abc')
        .send({ title: 'Should fail' });
 
      expect(res.status).toBe(401);
    });
 
    it('returns 401 when X-User-Id is missing on PATCH', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id, 'Ticket');
 
      const res = await request(app)
        .patch(`/tickets/${ticket.id}/status`)
        .send({ status: 'DONE' });
 
      expect(res.status).toBe(401);
    });
 
    it('does not require X-User-Id on GET requests', async () => {
      const res = await request(app).get('/tickets');
      expect(res.status).toBe(200);
    });
  });
 
  describe('Tickets', () => {
    it('creates a ticket with creator_id taken from X-User-Id', async () => {
      const user = await createUser();
 
      const res = await request(app)
        .post('/tickets')
        .set('X-User-Id', String(user.id))
        .send({ title: 'Fix login bug', description: 'Users cannot log in' });
 
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Fix login bug',
        description: 'Users cannot log in',
        creator_id: user.id,
        status: 'TODO',
      });
    });
 
    it('returns a single ticket by id', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id, 'Ticket');
 
      const res = await request(app).get(`/tickets/${ticket.id}`);
 
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ticket.id);
    });
 
    it('returns 404 for a non-existent ticket', async () => {
      const res = await request(app).get('/tickets/999');
      expect(res.status).toBe(404);
    });
 
    it('rejects unknown fields in the body with 400', async () => {
      const user = await createUser();
 
      const res = await request(app)
        .post('/tickets')
        .set('X-User-Id', String(user.id))
        .send({ title: 'Sneaky', creator_id: 42 });
 
      expect(res.status).toBe(400);
    });
 
    it('returns 400 when X-User-Id does not match an existing user', async () => {
      const res = await request(app)
        .post('/tickets')
        .set('X-User-Id', '999')
        .send({ title: 'Orphan ticket' });
 
      expect(res.status).toBe(400);
    });
 
    it('updates a ticket status and returns 200', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id, 'Ticket');
 
      const res = await request(app)
        .patch(`/tickets/${ticket.id}/status`)
        .set('X-User-Id', String(user.id))
        .send({ status: 'DONE' });
 
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DONE');
    });
 
    it('returns 400 for an invalid status', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id, 'Ticket');
 
      const res = await request(app)
        .patch(`/tickets/${ticket.id}/status`)
        .set('X-User-Id', String(user.id))
        .send({ status: 'NOT_A_STATUS' });
 
      expect(res.status).toBe(400);
    });
 
    it('returns 404 when updating a non-existent ticket', async () => {
      const res = await request(app)
        .patch('/tickets/999/status')
        .set('X-User-Id', '1')
        .send({ status: 'DONE' });
 
      expect(res.status).toBe(404);
    });
  });
 
  describe('GET /tickets pagination and filtering', () => {
    it('paginates with limit and offset', async () => {
      const user = await createUser();
      for (let i = 1; i <= 5; i++) {
        await createTicket(user.id, `Ticket ${i}`);
      }
 
      const page1 = await request(app).get('/tickets?limit=2&offset=0');
      const page2 = await request(app).get('/tickets?limit=2&offset=2');
      const page3 = await request(app).get('/tickets?limit=2&offset=4');
 
      expect(page1.body.map((t: { title: string }) => t.title)).toEqual([
        'Ticket 1',
        'Ticket 2',
      ]);
      expect(page2.body.map((t: { title: string }) => t.title)).toEqual([
        'Ticket 3',
        'Ticket 4',
      ]);
      expect(page3.body.map((t: { title: string }) => t.title)).toEqual([
        'Ticket 5',
      ]);
    });
 
    it('returns all tickets when no limit is given', async () => {
      const user = await createUser();
      for (let i = 1; i <= 3; i++) {
        await createTicket(user.id, `Ticket ${i}`);
      }
 
      const res = await request(app).get('/tickets');
 
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });
 
    it('filters by status', async () => {
      const user = await createUser();
      const done = await createTicket(user.id, 'Done ticket');
      await createTicket(user.id, 'Todo ticket');
 
      await request(app)
        .patch(`/tickets/${done.id}/status`)
        .set('X-User-Id', String(user.id))
        .send({ status: 'DONE' });
 
      const res = await request(app).get('/tickets?status=DONE');
 
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Done ticket');
    });
 
    it('returns 400 for an invalid limit', async () => {
      const res = await request(app).get('/tickets?limit=-1');
      expect(res.status).toBe(400);
    });
  });
});