import {
  ApiErrorResponseSchema,
  type ApiErrorResponse,
} from '@aud-subjective/contracts';
import type { ZodType } from 'zod';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly requestId: string | undefined,
    readonly response: ApiErrorResponse | undefined,
  ) {
    super(response?.error.message ?? 'The request could not be completed.');
  }
}

type ApiRequestOptions<T> = {
  schema: ZodType<T>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

function isTransient(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiClientError && error.status >= 500)
  );
}

export async function apiGet<T>(
  path: `/api/v1/${string}`,
  { schema, signal, headers }: ApiRequestOptions<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(path, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { accept: 'application/json', ...headers },
        ...(signal ? { signal } : {}),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        throw new ApiClientError(
          response.status,
          response.headers.get('x-request-id') ?? undefined,
          ApiErrorResponseSchema.safeParse(body).data,
        );
      }

      return schema.parse(body);
    } catch (error) {
      lastError = error;
      if (attempt > 0 || signal?.aborted || !isTransient(error)) throw error;
    }
  }

  throw lastError;
}

export async function apiMutate<T>(
  path: `/api/v1/${string}`,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: unknown,
  { schema, signal, headers }: ApiRequestOptions<T>,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  const responseBody: unknown = await response.json();
  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      response.headers.get('x-request-id') ?? undefined,
      ApiErrorResponseSchema.safeParse(responseBody).data,
    );
  }
  return schema.parse(responseBody);
}
