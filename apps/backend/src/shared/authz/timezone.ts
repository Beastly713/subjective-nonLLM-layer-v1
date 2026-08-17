import { DomainError } from '../errors/domain-error.js';

export function normalizeMonitoringTimezone(value: string) {
  if (/^(?:[+-]|UTC[+-]|GMT[+-])/i.test(value.trim())) {
    throw new DomainError(
      400,
      'INVALID_MONITORING_TIMEZONE',
      'A valid IANA monitoring timezone is required.',
    );
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: value.trim(),
    }).resolvedOptions().timeZone;
  } catch {
    throw new DomainError(
      400,
      'INVALID_MONITORING_TIMEZONE',
      'A valid IANA monitoring timezone is required.',
    );
  }
}
