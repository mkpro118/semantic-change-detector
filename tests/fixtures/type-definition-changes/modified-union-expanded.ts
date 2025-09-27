export type T_IANATimezone = string;

export type ScheduledTimeBaseInputs = {
  startDate: Date;
  endDate: Date;
  /** IANA Timezone */
  localTimezone: T_IANATimezone;
};

// Union changed: expanded by one variant
export type Outcome = 'ok' | 'fail' | 'unknown';
