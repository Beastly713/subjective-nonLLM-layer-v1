import { ApiErrorResponseSchema } from '@aud-subjective/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  requestId: string,
  code: string,
  message: string,
) {
  return reply.status(statusCode).send(
    ApiErrorResponseSchema.parse({
      error: {
        code,
        message,
        requestId,
      },
    }),
  );
}

function acceptsHtml(request: FastifyRequest) {
  return (
    request.method === 'GET' && request.headers.accept?.includes('text/html')
  );
}

function isReservedBackendPath(url: string) {
  const path = url.split('?', 1)[0] ?? url;

  return (
    path === '/api' ||
    path.startsWith('/api/') ||
    path === '/health' ||
    path.startsWith('/health/')
  );
}

export function registerErrorHandlers(
  app: FastifyInstance,
  servesWebApplication: boolean,
) {
  app.setNotFoundHandler((request, reply) => {
    if (
      servesWebApplication &&
      acceptsHtml(request) &&
      !isReservedBackendPath(request.url)
    ) {
      return reply.sendFile('index.html');
    }

    return sendApiError(
      reply,
      404,
      request.id,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  });

  app.setErrorHandler((error, request, reply) => {
    const isValidationError =
      typeof error === 'object' && error !== null && 'validation' in error;

    if (isValidationError) {
      return sendApiError(
        reply,
        400,
        request.id,
        'VALIDATION_ERROR',
        'The request was invalid.',
      );
    }

    request.log.error(
      {
        errorCode: 'INTERNAL_SERVER_ERROR',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      },
      'Request failed',
    );

    return sendApiError(
      reply,
      500,
      request.id,
      'INTERNAL_SERVER_ERROR',
      'The server could not complete the request.',
    );
  });
}
