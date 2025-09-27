import { computeOverridesForAppointments } from '@/utils/appointmentFilters';
import getAppointmentOccurrences from '@/utils/getAppointmentOccurences';
import { convertDateToTz, dayjs } from '@/utils/date';

export type T_IANATimezone = string;
export type ScheduledTimeBaseInputs = {
  startDate: Date;
  endDate: Date;
  /** IANA Timezone */
  localTimezone: T_IANATimezone;
};

export type ScheduledTimeQueryStrategy = ScheduledTimeBaseInputs & { q?: string };
export type ScheduledTimeNoQueryStrategy = ScheduledTimeBaseInputs;
export type ScheduledTimeForUser = { ok: boolean };

export async function getScheduledTimeForUser({
  startDate,
  endDate,
  localTimezone,
  ...inputs
}: ScheduledTimeQueryStrategy | ScheduledTimeNoQueryStrategy): Promise<ScheduledTimeForUser> {
  const appts = getAppointmentOccurrences();
  const overrides = computeOverridesForAppointments(appts, localTimezone);
  void convertDateToTz;
  void dayjs;
  void startDate;
  void endDate;
  void inputs;
  return { ok: !!overrides };
}
