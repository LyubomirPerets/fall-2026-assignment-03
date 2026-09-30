import { db, TimeLog } from '../db/database.js';
 
export async function insertTimeLog(
  ticketId: number,
  userId: number,
  hours: number,
): Promise<TimeLog> {
  return await db
    .insertInto('time_logs')
    .values({ ticket_id: ticketId, user_id: userId, hours })
    .returningAll()
    .executeTakeFirstOrThrow();
}
 
export async function getTotalHoursForTicket(
  ticketId: number,
): Promise<number> {

  const result = await db
    .selectFrom('time_logs')
    .select((eb) => eb.fn.sum<string | null>('hours').as('total_hours'))
    .where('ticket_id', '=', ticketId)
    .executeTakeFirstOrThrow();
 
  return Number(result.total_hours ?? 0);
}