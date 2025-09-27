// Imports reordered intentionally (should be ignored if no runtime impact)
import { convertDateToTz, dayjs } from '@/utils/date';
import { computeOverridesForAppointments } from '@/utils/appointmentFilters';
import getAppointmentOccurrences from '@/utils/getAppointmentOccurences';

export type T_IANATimezone = string;
export type ScheduledTimeBaseInputs = {
  startDate: Date;
  endDate: Date;
  /** IANA Timezone */
  // localTimezone removed intentionally
};

export type ScheduledTimeQueryStrategy = ScheduledTimeBaseInputs & { q?: string };
export type ScheduledTimeNoQueryStrategy = ScheduledTimeBaseInputs;
export type ScheduledTimeForUser = { ok: boolean };

export async function getScheduledTimeForUser({
  startDate,
  endDate,
  // localTimezone removed intentionally
  ...inputs
}: ScheduledTimeQueryStrategy | ScheduledTimeNoQueryStrategy): Promise<ScheduledTimeForUser> {
  const appts = getAppointmentOccurrences();
  const overrides = computeOverridesForAppointments(appts);
  void convertDateToTz;
  void dayjs;
  void startDate;
  void endDate;
  void inputs;
  return { ok: !!overrides };
}
