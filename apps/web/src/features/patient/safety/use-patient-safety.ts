import {
  PatientSafetyProjectionSchema,
  type PatientSafetyProjection,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api/client';

export function usePatientSafety() {
  return useQuery({
    queryKey: ['patient', 'safety'],
    queryFn: ({ signal }) =>
      apiGet<PatientSafetyProjection>('/api/v1/patient/safety', {
        schema: PatientSafetyProjectionSchema,
        signal,
      }),
  });
}
