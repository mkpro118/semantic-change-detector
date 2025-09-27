// Specifier added (should be detected as low severity)
import { computeOverridesForAppointments } from '@/utils/appointmentFilters';
import getAppointmentOccurrences from '@/utils/getAppointmentOccurences';
import { convertDateToTz, dayjs, time } from '@/utils/date';

export const useIt = () => {
  void computeOverridesForAppointments;
  void getAppointmentOccurrences;
  void convertDateToTz;
  void dayjs;
  void time;
};
