import { computeOverridesForAppointments } from '@/utils/appointmentFilters';
import getAppointmentOccurrences from '@/utils/getAppointmentOccurences';
import { convertDateToTz, dayjs } from '@/utils/date';

export const useIt = () => {
  void computeOverridesForAppointments;
  void getAppointmentOccurrences;
  void convertDateToTz;
  void dayjs;
};
