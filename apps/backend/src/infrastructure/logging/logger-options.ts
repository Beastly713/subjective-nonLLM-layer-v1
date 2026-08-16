import type { AppConfig } from '../config/config.js';

const sensitiveLogPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'body.password',
  'body.token',
  'body.secret',
  'password',
  'token',
  'secret',
];

export function createLoggerOptions(logLevel: AppConfig['logLevel']) {
  return {
    level: logLevel,
    redact: {
      paths: sensitiveLogPaths,
      censor: '[REDACTED]',
    },
  };
}
