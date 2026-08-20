import {
  OtherSubstanceCategorySchema,
  PregnancyStatusSchema,
  SeriousMedicalContextSchema,
  WithdrawalSymptomSchema,
  type SafetyDraftInput,
  type TriState,
} from '@aud-subjective/contracts';
import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BooleanChoice, TriStateChoice } from '../onboarding-response-controls';
import type { OnboardingStepProps } from '../types';
import { formatEnumLabel } from '../types';

const yesNoFields = [
  ['currentSeizure', 'Are you having a seizure now?'],
  [
    'severeConfusionOrDisorientation',
    'Are you experiencing severe confusion or disorientation?',
  ],
  ['hallucinations', 'Are you experiencing hallucinations?'],
  [
    'hallucinationDisorientation',
    'Are the hallucinations accompanied by disorientation?',
  ],
  [
    'difficultyRemainingConscious',
    'Are you having difficulty remaining conscious?',
  ],
  ['breathingDifficulty', 'Are you having difficulty breathing?'],
  [
    'repeatedVomitingWithSevereIllness',
    'Are you having repeated vomiting with severe illness?',
  ],
  ['currentSuicideAttempt', 'Is a suicide attempt happening now?'],
  [
    'currentSelfHarmMedicalEmergency',
    'Is there a current self-harm medical emergency?',
  ],
  [
    'immediateSuicidePlanAndIntent',
    'Is there an immediate suicide plan and intent to act now?',
  ],
] as const;

const cssrsFields = [
  [
    'item1',
    'Have you wished you were dead or wished you could go to sleep and not wake up?',
  ],
  ['item2', 'Have you had thoughts of killing yourself?'],
  ['item3', 'Have you thought about how you might do this?'],
  ['item4', 'Have you had any intention of acting on these thoughts?'],
  [
    'item5',
    'Have you started to work out the details of how to kill yourself?',
  ],
  [
    'suicidalBehaviorPrevious3Months',
    'Has suicidal behavior occurred in the previous three months?',
  ],
] as const;

const triStateFields = [
  ['previousWithdrawalSeizure', 'Have you ever had a withdrawal seizure?'],
  [
    'previousWithdrawalDelirium',
    'Have you ever had withdrawal delirium or severe confusion during withdrawal?',
  ],
  [
    'similarHeavyRegularUseAtLeast3Months',
    'Has there been similar heavy, regular use for at least three months?',
  ],
  ['sedativeDependence', 'Is there dependence on sedatives?'],
  [
    'dailyOrNearDailySedativeOrOpioidUse',
    'Has there been daily or near-daily sedative or opioid use?',
  ],
  [
    'priorSedativeOrOpioidWithdrawalSymptoms',
    'Have there been prior sedative or opioid withdrawal symptoms?',
  ],
] as const;

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <p className="m-0 text-sm font-semibold text-primary">{eyebrow}</p>
        <h3 className="m-0 mt-1 text-xl font-semibold">{title}</h3>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  helpText,
}: {
  label: string;
  value: string | undefined;
  options: readonly string[];
  onChange: (value: string) => void;
  helpText?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <select
        className="h-11 rounded-md border bg-surface px-3"
        onChange={(event) => onChange(event.target.value)}
        value={value ?? ''}
      >
        <option value="">Choose an answer</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatEnumLabel(option)}
          </option>
        ))}
      </select>
      {helpText ? (
        <span className="font-normal text-muted-foreground">{helpText}</span>
      ) : null}
    </label>
  );
}

function ToggleList({
  label,
  options,
  selected,
  onChange,
  helpText,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (value: string) => void;
  helpText?: string;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-semibold">{label}</legend>
      {helpText ? (
        <p className="m-0 text-sm text-muted-foreground">{helpText}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
            key={option}
          >
            <input
              checked={selected.includes(option)}
              className="mt-1 size-4 accent-primary"
              onChange={() => onChange(option)}
              type="checkbox"
            />
            <span>{formatEnumLabel(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function localDateTime(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

export function SafetyStep({
  safety,
  updateSafety,
  updateCssrs,
}: OnboardingStepProps) {
  const hallucinations = safety.hallucinations;
  const currentSymptoms = safety.currentWithdrawalSymptoms ?? [];
  const substances = safety.otherSubstanceCategories ?? [];
  const seriousMedicalContexts = safety.seriousMedicalContexts ?? [];

  const updateBoolean = (
    key: (typeof yesNoFields)[number][0],
    value: boolean,
  ) => {
    updateSafety({
      [key]: value,
      ...(key === 'hallucinations' && !value
        ? { hallucinationDisorientation: false }
        : {}),
    } as Partial<SafetyDraftInput>);
  };

  const updateSubstances = (value: string) => {
    if (value === 'NONE' || value === 'PREFER_NOT_TO_SAY') {
      updateSafety({
        otherSubstanceCategories: [value] as NonNullable<
          SafetyDraftInput['otherSubstanceCategories']
        >,
      });
      return;
    }
    const next = substances.includes(value as never)
      ? substances.filter((item) => item !== value)
      : [
          ...substances.filter(
            (item) => item !== 'NONE' && item !== 'PREFER_NOT_TO_SAY',
          ),
          value,
        ];
    updateSafety({
      otherSubstanceCategories: next as NonNullable<
        SafetyDraftInput['otherSubstanceCategories']
      >,
    });
  };

  const updateSymptoms = (value: string) => {
    const next = currentSymptoms.includes(value as never)
      ? currentSymptoms.filter((item) => item !== value)
      : [...currentSymptoms, value];
    updateSafety({
      currentWithdrawalSymptoms: next as NonNullable<
        SafetyDraftInput['currentWithdrawalSymptoms']
      >,
    });
  };

  const updateMedicalContexts = (value: string) => {
    const next = seriousMedicalContexts.includes(value as never)
      ? seriousMedicalContexts.filter((item) => item !== value)
      : [...seriousMedicalContexts, value];
    updateSafety({
      seriousMedicalContexts: next as NonNullable<
        SafetyDraftInput['seriousMedicalContexts']
      >,
    });
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <p className="m-0 text-sm font-semibold text-danger">Safety check</p>
          <h2 className="m-0 mt-1 text-2xl font-semibold">
            A complete current-safety picture
          </h2>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
            Answer what you can. This screen records your responses for the
            server-side safety evaluator; it does not calculate a severity in
            the browser.
          </p>
        </CardHeader>
      </Card>

      <SectionCard
        description="These questions check for current conditions that may need immediate clinical attention."
        eyebrow="Current state"
        title="Emergency and current symptoms"
      >
        {yesNoFields.map(([key, label]) => {
          const hallucinationDisorientationDisabled =
            key === 'hallucinationDisorientation' && hallucinations === false;

          return (
            <BooleanChoice
              key={key}
              label={label}
              onChange={(value) => updateBoolean(key, value)}
              value={safety[key]}
              disabled={hallucinationDisorientationDisabled}
              {...(hallucinationDisorientationDisabled
                ? {
                    helpText:
                      'Not applicable when hallucinations are reported as no.',
                  }
                : {})}
            />
          );
        })}
      </SectionCard>

      <SectionCard
        description="Share relevant history and risk context. Unsure is an accepted response."
        eyebrow="History"
        title="Withdrawal history"
      >
        {triStateFields.slice(0, 3).map(([key, label]) => (
          <TriStateChoice
            key={key}
            label={label}
            onChange={(value) =>
              updateSafety({ [key]: value } as Partial<SafetyDraftInput>)
            }
            value={safety[key] as TriState | undefined}
          />
        ))}
        <SelectField
          label="How many prior alcohol withdrawals have you had?"
          onChange={(value) =>
            updateSafety({
              priorWithdrawals: value as NonNullable<
                SafetyDraftInput['priorWithdrawals']
              >,
            })
          }
          options={['0', '1_2', 'THREE_OR_MORE', 'UNSURE']}
          value={safety.priorWithdrawals}
        />
        <TriStateChoice
          label="Is your age over 65?"
          onChange={(value) => updateSafety({ ageOver65: value })}
          value={safety.ageOver65}
        />
      </SectionCard>

      <SectionCard
        description="Record timing and symptoms without creating a future reduction baseline."
        eyebrow="Recent change"
        title="Reduction and withdrawal symptoms"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            When did a reduction start? (optional)
            <Input
              onChange={(event) =>
                updateSafety({
                  reductionStartedAt: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : null,
                })
              }
              type="datetime-local"
              value={localDateTime(safety.reductionStartedAt)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Approximate reduction percentage (optional)
            <Input
              max={100}
              min={0}
              onChange={(event) =>
                updateSafety({
                  reductionPercent:
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                })
              }
              type="number"
              value={safety.reductionPercent ?? ''}
            />
          </label>
        </div>
        <BooleanChoice
          label="Has drinking stopped completely?"
          onChange={(value) => updateSafety({ cessation: value })}
          value={safety.cessation}
        />
        <ToggleList
          helpText="Select every symptom that applies. Selecting an option twice does not create duplicates."
          label="Current withdrawal symptoms"
          onChange={updateSymptoms}
          options={WithdrawalSymptomSchema.options}
          selected={currentSymptoms}
        />
      </SectionCard>

      <SectionCard
        description="These categories are used together with the current-symptom responses."
        eyebrow="Other substances"
        title="Sedative and opioid context"
      >
        {triStateFields.slice(3).map(([key, label]) => (
          <TriStateChoice
            key={key}
            label={label}
            onChange={(value) =>
              updateSafety({ [key]: value } as Partial<SafetyDraftInput>)
            }
            value={safety[key] as TriState | undefined}
          />
        ))}
        <ToggleList
          helpText="None and prefer not to say cannot be combined with another category."
          label="Other substance categories"
          onChange={updateSubstances}
          options={OtherSubstanceCategorySchema.options}
          selected={substances}
        />
      </SectionCard>

      <SectionCard
        description="Record the medical and pregnancy context that should travel with the evaluation."
        eyebrow="Medical context"
        title="Medical and pregnancy context"
      >
        <SelectField
          label="Pregnancy status"
          onChange={(value) =>
            updateSafety({
              pregnancy: value as NonNullable<SafetyDraftInput['pregnancy']>,
            })
          }
          options={PregnancyStatusSchema.options}
          value={safety.pregnancy}
        />
        <BooleanChoice
          label="Is alcohol currently being used?"
          onChange={(value) => updateSafety({ currentAlcoholUse: value })}
          value={safety.currentAlcoholUse}
        />
        <ToggleList
          label="Serious medical contexts"
          onChange={updateMedicalContexts}
          options={SeriousMedicalContextSchema.options}
          selected={seriousMedicalContexts}
        />
        <BooleanChoice
          label="Is there a stable medical condition to note?"
          onChange={(value) => updateSafety({ stableMedicalCondition: value })}
          value={safety.stableMedicalCondition}
        />
        <BooleanChoice
          label="Has a clinician directed a safety review?"
          onChange={(value) => updateSafety({ clinicianDirectedReview: value })}
          value={safety.clinicianDirectedReview}
        />
      </SectionCard>

      <SectionCard
        description="For this V1 flow, answer the existing contract fields with yes, no, or unsure."
        eyebrow="C-SSRS context"
        title="Suicidal thoughts and behavior"
      >
        {cssrsFields.map(([key, label]) => (
          <TriStateChoice
            key={key}
            label={label}
            onChange={(value) => updateCssrs(key, value)}
            value={safety.cssrs?.[key] as TriState | undefined}
          />
        ))}
      </SectionCard>

      <p className="m-0 text-sm leading-6 text-muted-foreground">
        You can save this safety draft at any point. The authoritative
        evaluation is submitted only after all required fields are answered.
      </p>
    </div>
  );
}
