import { expect, test, type Route } from '@playwright/test';

const assessmentId = '00000000-0000-4000-8000-000000000401';

const revisionId = '00000000-0000-4000-8000-000000000402';

const periodId = '00000000-0000-4000-8000-000000000403';

const scheduleId = '00000000-0000-4000-8000-000000000404';

const goalVersionId = '00000000-0000-4000-8000-000000000405';

const preferenceVersionId = '00000000-0000-4000-8000-000000000406';

const period = {
  periodId,
  scheduleVersionId: scheduleId,
  scheduleVersion: 1,
  monitoringTimezone: 'America/New_York',
  periodStartAt: '2026-08-10T04:00:00.000Z',
  periodEndAt: '2026-08-17T04:00:00.000Z',
  openAt: '2026-08-17T04:00:00.000Z',
  originalDueAt: '2026-08-18T04:00:00.000Z',
  effectiveDueAt: '2026-08-18T04:00:00.000Z',
  version: 1,
  status: 'LATE',
  displayRecallStartDate: '2026-08-10',
  displayRecallEndDate: '2026-08-16',
} as const;

const scaleItems = [
  ['R1', 'sleep_difficulty', 'Sleep difficulty'],
  ['R2', 'negative_mood', 'Negative mood'],
  ['R3', 'craving', 'Craving'],
  ['R4', 'risky_situations', 'Risky situations'],
  ['R5', 'relationship_problems', 'Relationship problems'],
  ['P1', 'recovery_confidence', 'Recovery confidence'],
  ['P2', 'mutual_help_participation', 'Mutual help participation'],
  ['P3', 'spiritual_activity', 'Spiritual activity'],
  ['P4', 'productive_recreational_activity', 'Productive activity'],
  ['P5', 'family_friend_support', 'Family or friend support'],
] as const;

const instrument = {
  instrumentId: 'AUD_WEEKLY_CHECKIN',
  instrumentVersion: '1.0',
  displayName: 'Weekly Recovery Check-In',
  type: 'CUSTOM_A_CHESS_BAM_INFORMED',
  exactBam: false,
  exactAChessReplication: false,
  wordingVersion: '1.0',
  scaleVersion: '1.0',
  policy: {
    ruleSetVersion: 'subjective_monitoring_v1',
    configurationVersion: 'subjective_monitoring_v1',
  },
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
  ],
  items: [
    {
      itemId: 'U1',
      key: 'alcohol_use_reported',
      type: 'BOOLEAN',
      prompt: 'Did you drink alcohol during this period?',
      responseLabels: {
        false: 'No',
        true: 'Yes',
      },
    },
    ...scaleItems.map(([itemId, key, prompt]) => ({
      itemId,
      key,
      type: 'INTEGER_0_7',
      direction: itemId.startsWith('P')
        ? 'HIGHER_IS_BETTER'
        : 'HIGHER_IS_WORSE',
      prompt,
      anchors: {
        zero: 'Not at all',
        seven: 'Extremely',
      },
    })),
  ],
} as const;

const safety = {
  safetyState: 'MONITORING_AVAILABLE',
  requiresSafetyShell: false,
  handoffStatus: 'NONE',
  allowedSubjectiveInterventions: [],
  monitoringPromptPolicy: 'CONTINUE',
  goalChangeAllowed: true,
  reassessmentDueAt: null,
  routeAvailability: 'NOT_REQUIRED',
  patientRouteActions: [],
} as const;

const goalContext = {
  goalVersionId,
  goalVersion: 1,
  goal: 'REDUCTION',
  status: 'ACTIVE',
  effectiveFromPeriodId: periodId,
  baselineRevisionId: '00000000-0000-4000-8000-000000000407',
  baselineAverageWeeklyDrinks: 14,
  targetWeeklyStandardDrinks: 7,
} as const;

const preferenceContext = {
  preferenceVersionId,
  preferenceVersion: 1,
  mutualHelpPreference: 'UNSURE',
  spiritualContentPreference: 'UNSURE',
} as const;

const dates = [
  '2026-08-10',
  '2026-08-11',
  '2026-08-12',
  '2026-08-13',
  '2026-08-14',
  '2026-08-15',
  '2026-08-16',
] as const;

function fullAnswers() {
  return {
    U1: false,
    R1: 1,
    R2: 1,
    R3: 1,
    R4: 1,
    R5: 1,
    P1: 6,
    P2: 6,
    P3: 6,
    P4: 6,
    P5: 6,
  };
}

function correctionDetail() {
  return {
    assessmentId,
    period,
    instrument,
    goalContext,
    preferenceContext,
    weeklyConsumptionDates: dates,
    authoritativeRevision: {
      revisionId,
      revisionNumber: 1,
      submittedAt: '2026-08-18T05:00:00.000Z',
      submittedBy: 'PATIENT',
      submissionClassification: 'LATE_CURRENT',
      completionStatus: 'COMPLETE',
      isAuthoritative: true,
      answers: fullAnswers(),
      weeklyConsumptionDays: dates.map((localDate) => ({
        localDate,
        status: 'KNOWN_ZERO',
        standardDrinks: 0,
      })),
    },
    priorRevisions: [],
  } as const;
}

function correctionSuccess() {
  return {
    availability: 'HISTORICAL',
    assessment: {
      assessmentId,
      periodId,
      scheduledPeriodId: periodId,
      revisionId: '00000000-0000-4000-8000-000000000408',
      revisionNumber: 2,
      completionStatus: 'COMPLETE',
      submissionClassification: 'PATIENT_CORRECTION',
      submittedAt: '2026-08-21T15:00:00.000Z',
      sourceDraftVersion: null,
    },
    instrument,
    period,
    goalContext,
    preferenceContext,
    safety,
    weeklyConsumptionRequired: true,
    weeklyConsumptionDates: dates,
  } as const;
}

function backfillState() {
  return {
    availability: 'HISTORICAL',
    assessment: {
      assessmentId,
      scheduledPeriodId: periodId,
      instrumentId: 'AUD_WEEKLY_CHECKIN',
      instrumentVersion: '1.0',

      draftVersion: 0 as number,

      currentStep: 'ALCOHOL_USE' as string,

      answers: {} as Record<string, unknown>,

      weeklyConsumptionDays: [] as unknown[],

      completionStatus: 'DRAFT',
    },
    instrument,
    period,
    goalContext,
    preferenceContext,
    safety,
    weeklyConsumptionRequired: true,
    weeklyConsumptionDates: dates,
  } as const;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test('correction renders backend dates and reuses the same idempotency key after a failed request', async ({
  page,
}) => {
  const correctionKeys: string[] = [];
  let correctionAttempts = 0;

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();

    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'GET' &&
      pathname === `/api/v1/patient/assessments/${assessmentId}`
    ) {
      return fulfillJson(route, correctionDetail());
    }

    if (
      request.method() === 'POST' &&
      pathname === `/api/v1/patient/assessments/${assessmentId}/corrections`
    ) {
      correctionAttempts += 1;

      correctionKeys.push(request.headers()['idempotency-key'] ?? '');

      if (correctionAttempts === 1) {
        return fulfillJson(
          route,
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Synthetic retryable failure',
            },
          },
          500,
        );
      }

      return fulfillJson(route, correctionSuccess());
    }

    throw new Error(`Unexpected API request: ${request.method()} ${pathname}`);
  });

  await page.goto(
    `/patient/check-in/action?correctionAssessmentId=${assessmentId}`,
  );

  await expect(
    page.getByRole('heading', {
      name: 'Correct this check-in',
    }),
  ).toBeVisible();

  for (const localDate of dates) {
    await expect(page.getByText(localDate)).toBeVisible();
  }

  expect(await page.getByRole('radio').count()).toBeGreaterThanOrEqual(82);

  await page
    .getByRole('button', {
      name: /review correction/i,
    })
    .click();

  await page
    .getByRole('button', {
      name: /confirm and submit/i,
    })
    .click();

  await expect(page.getByText(/could not be submitted/i)).toBeVisible();

  await page
    .getByRole('button', {
      name: /review correction/i,
    })
    .click();

  await page
    .getByRole('button', {
      name: /confirm and submit/i,
    })
    .click();

  await expect(page).toHaveURL(/\/patient\/check-in\/history$/);

  expect(correctionKeys).toHaveLength(2);
  expect(correctionKeys[0]).toBeTruthy();
  expect(correctionKeys[1]).toBe(correctionKeys[0]);
});

test('historical backfill uses the backend recall dates and reuses its final-submit idempotency key on retry', async ({
  page,
}) => {
  const submitKeys: string[] = [];

  let backfillStateValue = backfillState();

  let submitAttempts = 0;

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();

    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'POST' &&
      pathname === `/api/v1/patient/check-in/backfill/${periodId}/start`
    ) {
      return fulfillJson(route, backfillStateValue);
    }

    if (
      request.method() === 'PUT' &&
      pathname === `/api/v1/patient/assessments/${assessmentId}/draft`
    ) {
      const payload = request.postDataJSON() as {
        expectedDraftVersion: number;
        answers: Record<string, unknown>;
        weeklyConsumptionDays: unknown[];
      };

      backfillStateValue = {
        ...backfillStateValue,
        assessment: {
          ...backfillStateValue.assessment,
          draftVersion: payload.expectedDraftVersion + 1,
          currentStep: 'REVIEW',
          answers: payload.answers,
          weeklyConsumptionDays: payload.weeklyConsumptionDays,
        },
      };

      return fulfillJson(route, backfillStateValue);
    }

    if (
      request.method() === 'POST' &&
      pathname === `/api/v1/patient/assessments/${assessmentId}/backfill-submit`
    ) {
      submitAttempts += 1;

      submitKeys.push(request.headers()['idempotency-key'] ?? '');

      if (submitAttempts === 1) {
        return fulfillJson(
          route,
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Synthetic retryable failure',
            },
          },
          500,
        );
      }

      return fulfillJson(route, {
        ...correctionSuccess(),
        assessment: {
          ...correctionSuccess().assessment,
          revisionNumber: 1,
          submissionClassification: 'HISTORICAL_BACKFILL',
        },
      });
    }

    throw new Error(`Unexpected API request: ${request.method()} ${pathname}`);
  });

  await page.goto(`/patient/check-in/action?backfillPeriodId=${periodId}`);

  await expect(
    page.getByRole('heading', {
      name: 'Complete a past check-in',
    }),
  ).toBeVisible();

  for (const localDate of dates) {
    await expect(page.getByText(localDate)).toBeVisible();
  }

  await page
    .getByRole('radio', {
      name: 'No',
      exact: true,
    })
    .click();

  for (const itemId of scaleItems.map(([itemId]) => itemId)) {
    await page
      .getByRole('radiogroup', {
        name: `${itemId} response`,
      })
      .getByRole('radio', {
        name: /score 1/i,
      })
      .click();
  }

  await page
    .getByRole('button', {
      name: /submit past check-in/i,
    })
    .click();

  await expect(
    page.getByText(
      /unanswered questions remain unknown|submitted past check-in/i,
    ),
  ).toBeVisible();

  await page
    .getByRole('button', {
      name: /confirm and submit/i,
    })
    .click();

  await expect(page.getByText(/could not be submitted/i)).toBeVisible();

  await page
    .getByRole('button', {
      name: /submit past check-in/i,
    })
    .click();

  await page
    .getByRole('button', {
      name: /confirm and submit/i,
    })
    .click();

  await expect(page).toHaveURL(/\/patient\/check-in\/history$/);

  expect(submitKeys).toHaveLength(2);
  expect(submitKeys[0]).toBeTruthy();
  expect(submitKeys[1]).toBe(submitKeys[0]);
});

test('patient correction/backfill surfaces do not reveal internal monitoring state', async ({
  page,
}) => {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();

    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'GET' &&
      pathname === `/api/v1/patient/assessments/${assessmentId}`
    ) {
      return fulfillJson(route, correctionDetail());
    }

    throw new Error(`Unexpected API request: ${request.method()} ${pathname}`);
  });

  await page.goto(
    `/patient/check-in/action?correctionAssessmentId=${assessmentId}`,
  );

  const body = await page.locator('body').innerText();

  expect(body).not.toMatch(/riskScore|rawProtectionScore|HIGH_CRAVING/i);

  expect(body).not.toMatch(/Level 2|Level 3|CRAVING_LOW_CONFIDENCE/i);

  await page.setViewportSize({
    width: 390,
    height: 844,
  });

  await expect(
    page.getByRole('heading', {
      name: 'Correct this check-in',
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: /review correction/i,
    }),
  ).toBeVisible();
});
