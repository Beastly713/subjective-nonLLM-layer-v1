import type { AppConfig } from '../config/config.js';

const sensitiveLogPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.url',
  'req.query.token',
  'res.headers["set-cookie"]',
  'res.headers.location',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'body.password',
  'body.token',
  'body.secret',
  'body.newPassword',
  'body.currentPassword',
  'body.resetToken',
  'body.verificationToken',
  'body.totpSecret',
  'body.backupCodes',
  'body.code',
  'password',
  'token',
  'secret',
  'resetToken',
  'verificationToken',
  'totpSecret',
  'backupCodes',
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
