export const CSSRS_RECENT_PROVENANCE = {
  instrument: 'C-SSRS Screener Recent',
  version: 'RECENT_CONFIGURATION_UNAVAILABLE',
  source: 'INSTRUMENT_CONFIGURATION_UNAVAILABLE',
  configurationAvailable: false,
} as const;

export const SAFETY_SCREEN_PROVENANCE = {
  instrument: 'AUD_SAFETY_GATE_ONBOARDING',
  version: '1.0',
  source: 'subjective_monitoring_v1 safety-gate specification',
  cssrs: CSSRS_RECENT_PROVENANCE,
} as const;
