export const AUD_WEEKLY_CHECKIN_INSTRUMENT_ID = 'AUD_WEEKLY_CHECKIN' as const;
export const AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION = '1.0' as const;
export const AUD_WEEKLY_CHECKIN_WORDING_VERSION = '1.0' as const;
export const AUD_WEEKLY_CHECKIN_SCALE_VERSION = '1.0' as const;

export type WeeklyCheckInGoal = 'ABSTINENCE' | 'REDUCTION' | 'UNSURE';
export type WeeklyCheckInItemType = 'BOOLEAN' | 'INTEGER_0_7';
export type WeeklyCheckInDirection = 'HIGHER_IS_WORSE' | 'HIGHER_IS_BETTER';

type BooleanItem = {
  itemId: 'U1';
  key: 'alcohol_use_reported';
  type: 'BOOLEAN';
  prompt: 'During this 7-day period, did you drink any alcohol?';
  responseLabels: { false: 'NO'; true: 'YES' };
};

type ScaleItem = {
  itemId: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'P2' | 'P3' | 'P4' | 'P5';
  key:
    | 'sleep_difficulty'
    | 'negative_mood'
    | 'craving'
    | 'risky_situations'
    | 'relationship_problems'
    | 'mutual_help_participation'
    | 'spiritual_activity'
    | 'productive_recreational_activity'
    | 'family_friend_support';
  type: 'INTEGER_0_7';
  direction: WeeklyCheckInDirection;
  prompt: string;
  anchors: { zero: string; seven: string };
};

type P1Item = {
  itemId: 'P1';
  key: 'recovery_confidence';
  type: 'INTEGER_0_7';
  direction: 'HIGHER_IS_BETTER';
  anchors: { zero: 'Not at all confident'; seven: 'Completely confident' };
  wordingByGoal: {
    ABSTINENCE: 'During this 7-day period, how confident were you that you could remain alcohol-free?';
    REDUCTION: 'During this 7-day period, how confident were you that you could stay within your drinking-reduction goal?';
    UNSURE: 'During this 7-day period, how confident were you that you could follow the alcohol-related change you currently want to make?';
  };
};

export const AUD_WEEKLY_CHECKIN_V1 = {
  instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
  instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
  displayName: 'Weekly Recovery Check-In',
  type: 'CUSTOM_A_CHESS_BAM_INFORMED',
  exactBam: false,
  exactAChessReplication: false,
  wordingVersion: AUD_WEEKLY_CHECKIN_WORDING_VERSION,
  scaleVersion: AUD_WEEKLY_CHECKIN_SCALE_VERSION,
  requiredItemIds: [
    'U1',
    'R1',
    'R2',
    'R3',
    'R4',
    'R5',
    'P1',
    'P2',
    'P3',
    'P4',
    'P5',
  ] as const,
  items: [
    {
      itemId: 'U1',
      key: 'alcohol_use_reported',
      type: 'BOOLEAN',
      prompt: 'During this 7-day period, did you drink any alcohol?',
      responseLabels: { false: 'NO', true: 'YES' },
    },
    {
      itemId: 'R1',
      key: 'sleep_difficulty',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_WORSE',
      prompt:
        'During this 7-day period, how much difficulty did you have with your sleep, such as falling asleep, staying asleep, or getting restful sleep?',
      anchors: { zero: 'No difficulty', seven: 'Extreme difficulty' },
    },
    {
      itemId: 'R2',
      key: 'negative_mood',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_WORSE',
      prompt:
        'During this 7-day period, how much were you troubled by negative feelings such as sadness, anxiety, anger, or feeling very upset?',
      anchors: { zero: 'Not at all', seven: 'Extremely' },
    },
    {
      itemId: 'R3',
      key: 'craving',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_WORSE',
      prompt:
        'During this 7-day period, how strong were your urges or cravings to drink alcohol?',
      anchors: {
        zero: 'No urge or craving',
        seven: 'Extremely strong urge or craving',
      },
    },
    {
      itemId: 'R4',
      key: 'risky_situations',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_WORSE',
      prompt:
        'During this 7-day period, how much were you exposed to situations in which drinking alcohol was tempting or harder to avoid?',
      anchors: { zero: 'Not at all', seven: 'Extremely' },
    },
    {
      itemId: 'R5',
      key: 'relationship_problems',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_WORSE',
      prompt:
        'During this 7-day period, how much were you troubled by problems or conflict in your close relationships?',
      anchors: { zero: 'Not at all', seven: 'Extremely' },
    },
    {
      itemId: 'P1',
      key: 'recovery_confidence',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_BETTER',
      anchors: { zero: 'Not at all confident', seven: 'Completely confident' },
      wordingByGoal: {
        ABSTINENCE:
          'During this 7-day period, how confident were you that you could remain alcohol-free?',
        REDUCTION:
          'During this 7-day period, how confident were you that you could stay within your drinking-reduction goal?',
        UNSURE:
          'During this 7-day period, how confident were you that you could follow the alcohol-related change you currently want to make?',
      },
    },
    {
      itemId: 'P2',
      key: 'mutual_help_participation',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_BETTER',
      prompt:
        'During this 7-day period, how much did you participate in mutual-help or peer-support activities that are part of your recovery, such as AA or another recovery group?',
      anchors: { zero: 'No participation', seven: 'Very high participation' },
    },
    {
      itemId: 'P3',
      key: 'spiritual_activity',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_BETTER',
      prompt:
        'During this 7-day period, how much did spiritual or religious activities support your recovery?',
      anchors: { zero: 'Not at all', seven: 'Extremely' },
    },
    {
      itemId: 'P4',
      key: 'productive_recreational_activity',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_BETTER',
      prompt:
        'During this 7-day period, how much did productive or enjoyable activities—such as work, study, exercise, hobbies, volunteering, or recreation—support your recovery?',
      anchors: { zero: 'Not at all', seven: 'Extremely' },
    },
    {
      itemId: 'P5',
      key: 'family_friend_support',
      type: 'INTEGER_0_7',
      direction: 'HIGHER_IS_BETTER',
      prompt:
        'During this 7-day period, how much support for your recovery did you receive from family or friends?',
      anchors: { zero: 'No support', seven: 'Extremely strong support' },
    },
  ] as const satisfies readonly [BooleanItem, ...(ScaleItem | P1Item)[]],
} as const;

export type AudWeeklyCheckInItem = (typeof AUD_WEEKLY_CHECKIN_V1.items)[number];

export function p1WordingForGoal(goal: WeeklyCheckInGoal) {
  const item = AUD_WEEKLY_CHECKIN_V1.items.find(
    (candidate) => candidate.itemId === 'P1',
  );
  if (!item || item.itemId !== 'P1')
    throw new Error('P1 policy item is missing.');
  return item.wordingByGoal[goal];
}
