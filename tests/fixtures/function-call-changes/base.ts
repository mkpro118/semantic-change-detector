// Base: 2 args
const appointments: Array<{ id: number }> = [];
const localTimezone: string = 'UTC';

function computeOverridesForAppointments(a: unknown, b?: unknown): unknown {
  return { a, b };
}

export const result = computeOverridesForAppointments(appointments, localTimezone);
