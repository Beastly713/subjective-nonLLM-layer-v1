import {
  PatientSupportResponseSchema,
  type PatientSupportResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api/client';

export function usePatientSupport() {
  return useQuery({
    queryKey: ['patient', 'support'],
    queryFn: ({ signal }) =>
      apiGet<PatientSupportResponse>('/api/v1/patient/support', {
        schema: PatientSupportResponseSchema,
        signal,
      }),
  });
}
