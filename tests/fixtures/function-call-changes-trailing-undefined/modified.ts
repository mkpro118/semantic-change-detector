// Modified: trailing undefined removed (should be ignored)
const appointments: Array<{ id: number }> = [];

function computeOverridesForAppointments(a: unknown, b?: unknown): unknown {
  return { a, b };
}

export const result = computeOverridesForAppointments(appointments);
