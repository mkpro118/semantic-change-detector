// Same imports reordered (should be ignored if no runtime impact)
import { convertDateToTz, dayjs } from '@/utils/date';
import { computeOverridesForAppointments } from '@/utils/appointmentFilters';
import getAppointmentOccurrences from '@/utils/getAppointmentOccurences';

export const useIt = () => {
  void convertDateToTz;
  void dayjs;
  void computeOverridesForAppointments;
  void getAppointmentOccurrences;
};
