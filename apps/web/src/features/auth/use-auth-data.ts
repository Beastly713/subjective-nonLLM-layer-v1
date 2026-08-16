import {
  AuthCapabilitiesResponseSchema,
  CurrentSessionResponseSchema,
  type AuthCapabilitiesResponse,
  type CurrentSessionResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api/client';

export function useAuthCapabilities() {
  return useQuery({
    queryKey: ['auth', 'capabilities'],
    queryFn: ({ signal }) =>
      apiGet<AuthCapabilitiesResponse>('/api/v1/auth/capabilities', {
        schema: AuthCapabilitiesResponseSchema,
        signal,
      }),
    staleTime: 5 * 60_000,
  });
}

export function useCurrentSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: ({ signal }) =>
      apiGet<CurrentSessionResponse>('/api/v1/auth/session', {
        schema: CurrentSessionResponseSchema,
        signal,
      }),
    retry: false,
  });
}
