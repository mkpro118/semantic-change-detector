export type T_IANATimezone = string;

export type ScheduledTimeBaseInputs = {
  startDate: Date;
  endDate: Date;
  /** IANA Timezone */
  // localTimezone removed intentionally
};

// Union example to exercise normalization (unchanged here)
export type Outcome = 'ok' | 'fail';
