export type T_IANATimezone = string;

export type ScheduledTimeQueryStrategy = {
  startDate: Date;
  endDate: Date;
  /** IANA Timezone */
  localTimezone: T_IANATimezone;
  [key: string]: unknown;
};

export type ScheduledTimeNoQueryStrategy = ScheduledTimeQueryStrategy;

export type ScheduledTimeForUser = { ok: boolean };

export async function getScheduledTimeForUser({
  startDate,
  endDate,
  // localTimezone removed intentionally
  ...inputs
}: ScheduledTimeQueryStrategy | ScheduledTimeNoQueryStrategy): Promise<ScheduledTimeForUser> {
  void startDate;
  void endDate;
  void inputs;
  return { ok: true };
}
