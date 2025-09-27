export type T_IANATimezone = string;

export type ScheduledTimeBaseInputs = {
  startDate: Date;
  endDate: Date;
  /** IANA Timezone */
  localTimezone: T_IANATimezone;
};

// Union example to exercise normalization
export type Outcome = 'ok' | 'fail';
