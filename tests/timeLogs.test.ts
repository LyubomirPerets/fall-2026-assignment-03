import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

async function createUser(name = 'Alice', email = 'alice@example.com') {
  const res = await request(app)
    .post('/users')
    .set('X-User-Id', '1')
    .send({ name, email });
  expect(res.status).toBe(201);
  return res.body as { id: number };
}
 
async function createTicket(userId: number, title = 'Ticket') {
  const res = await request(app)
    .post('/tickets')
    .set('X-User-Id', String(userId))
    .send({ title });
  expect(res.status).toBe(201);
  return res.body as { id: number };
}
 
function logHours(ticketId: number, userId: number, hours: unknown) {
  return request(app)
    .post(`/tickets/${ticketId}/time`)
    .set('X-User-Id', String(userId))
    .send({ hours });
}
 
describe('Part 2: Time Logs Tests', () => {
  describe('POST /tickets/:id/time', () => {
    it('logs hours and returns 201 with the created log', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id);
 
      const res = await logHours(ticket.id, user.id, 3);
 
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        ticket_id: ticket.id,
        user_id: user.id,
        hours: 3,
      });
      expect(res.body.id).toEqual(expect.any(Number));
      expect(res.body.logged_at).toBeDefined();
    });
 
    it('returns 401 when X-User-Id is missing', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id);
 
      const res = await request(app)
        .post(`/tickets/${ticket.id}/time`)
        .send({ hours: 3 });
 
      expect(res.status).toBe(401);
    });
 
    it('returns 404 for a non-existent ticket', async () => {
      const user = await createUser();
 
      const res = await logHours(999, user.id, 3);
 
      expect(res.status).toBe(404);
    });
 
    it.each([
      ['zero', 0],
      ['negative', -2],
      ['a decimal', 1.5],
      ['a string', '3'],
      ['missing', undefined],
    ])('returns 400 when hours is %s', async (_label, hours) => {
      const user = await createUser();
      const ticket = await createTicket(user.id);
 
      const res = await logHours(ticket.id, user.id, hours);
 
      expect(res.status).toBe(400);
    });
  });
 
  describe('GET /tickets/:id/time', () => {
    it('returns the sum of all logged hours for a ticket', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id);
 
      const inputs = [2, 3, 5, 8];
      for (const hours of inputs) {
        expect((await logHours(ticket.id, user.id, hours)).status).toBe(201);
      }
 
      const res = await request(app).get(`/tickets/${ticket.id}/time`);
 
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ticket_id: ticket.id, total_hours: 18 });
    });
 
    it('returns total_hours as a number, not a string', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id);
      await logHours(ticket.id, user.id, 4);
 
      const res = await request(app).get(`/tickets/${ticket.id}/time`);
 
      expect(typeof res.body.total_hours).toBe('number');
      expect(typeof res.body.ticket_id).toBe('number');
    });
 
    it('includes hours logged by different users', async () => {
      const alice = await createUser('Alice', 'alice@example.com');
      const bob = await createUser('Bob', 'bob@example.com');
      const ticket = await createTicket(alice.id);
 
      await logHours(ticket.id, alice.id, 4);
      await logHours(ticket.id, bob.id, 6);
 
      const res = await request(app).get(`/tickets/${ticket.id}/time`);
 
      expect(res.body.total_hours).toBe(10);
    });
 
    it('only counts hours logged against that ticket', async () => {
      const user = await createUser();
      const ticketA = await createTicket(user.id, 'Ticket A');
      const ticketB = await createTicket(user.id, 'Ticket B');
 
      await logHours(ticketA.id, user.id, 2);
      await logHours(ticketA.id, user.id, 3);
      await logHours(ticketB.id, user.id, 100);
 
      const resA = await request(app).get(`/tickets/${ticketA.id}/time`);
      const resB = await request(app).get(`/tickets/${ticketB.id}/time`);
 
      expect(resA.body.total_hours).toBe(5);
      expect(resB.body.total_hours).toBe(100);
    });
 
    it('returns 0 for a ticket with no time logged', async () => {
      const user = await createUser();
      const ticket = await createTicket(user.id);
 
      const res = await request(app).get(`/tickets/${ticket.id}/time`);
 
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ticket_id: ticket.id, total_hours: 0 });
    });
 
    it('returns 404 for a non-existent ticket', async () => {
      const res = await request(app).get('/tickets/999/time');
      expect(res.status).toBe(404);
    });
  });
});