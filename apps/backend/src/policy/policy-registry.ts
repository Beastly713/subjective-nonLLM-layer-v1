import {
  AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
  AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
  AUD_WEEKLY_CHECKIN_V1,
} from './instruments/aud-weekly-checkin-v1.js';
import { SUBJECTIVE_MONITORING_V1 } from './subjective-monitoring-v1.js';

export const POLICY_REGISTRY = {
  [AUD_WEEKLY_CHECKIN_INSTRUMENT_ID]: {
    instrument: AUD_WEEKLY_CHECKIN_V1,
    monitoring: SUBJECTIVE_MONITORING_V1,
  },
} as const;

export function getWeeklyCheckInPolicy(instrumentVersion = AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION) {
  if (instrumentVersion !== AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION) {
    throw new Error(`Unsupported weekly check-in instrument version: ${instrumentVersion}`);
  }
  return POLICY_REGISTRY[AUD_WEEKLY_CHECKIN_INSTRUMENT_ID];
}
