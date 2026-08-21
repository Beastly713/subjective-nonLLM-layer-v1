export const SUBJECTIVE_MONITORING_V1 = {
  ruleSetVersion: 'subjective_monitoring_v1',
  configurationVersion: 'subjective_monitoring_v1',
  thresholds: {
    HIGH_CRAVING: { operator: '>=', value: 6 },
    HIGH_NEGATIVE_MOOD: { operator: '>=', value: 6 },
    HIGH_RISKY_SITUATIONS: { operator: '>=', value: 6 },
    HIGH_RELATIONSHIP_PROBLEMS: { operator: '>=', value: 6 },
    LOW_CONFIDENCE: { operator: '<=', value: 2 },
    LOW_SOCIAL_SUPPORT: { operator: '<=', value: 2 },
    HIGH_RISK: { operator: '>=', value: 25 },
    WEAK_PROTECTION: { operator: '<=', value: 5, candidate: true },
    STRONG_PROTECTION: { operator: '>=', value: 25, candidate: true },
  },
  persistence: {
    N_PERSIST: 2,
    N_CLEAR: 2,
  },
  recurrenceWindowPeriods: 4,
  useAfterStabilityNegativePeriods: 12,
  interactionWhitelist: [
    ['HIGH_CRAVING', 'LOW_CONFIDENCE'],
    ['HIGH_NEGATIVE_MOOD', 'HIGH_CRAVING'],
    ['HIGH_RISK', 'WEAK_PROTECTION'],
    ['HIGH_RISK', 'STRONG_PROTECTION'],
  ],
} as const;
