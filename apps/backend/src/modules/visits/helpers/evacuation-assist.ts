import type { EvacuationAssistType } from '@vms/contracts';

export interface EvacuationAssistData {
  evacuationAssistTypes: EvacuationAssistType[];
  evacuationAssistOther: string | null;
}

/** The contract has already rejected "Yes" without a type and OTHER without a description. */
export function evacuationAssistData(answer: {
  needsEvacuationAssist: boolean;
  evacuationAssistTypes?: readonly EvacuationAssistType[];
  evacuationAssistOther?: string | null;
}): EvacuationAssistData {
  if (!answer.needsEvacuationAssist) {
    return { evacuationAssistTypes: [], evacuationAssistOther: null };
  }
  const types = [...new Set(answer.evacuationAssistTypes ?? [])];
  return {
    evacuationAssistTypes: types,
    evacuationAssistOther: types.includes('OTHER')
      ? answer.evacuationAssistOther?.trim() || null
      : null,
  };
}

const LABEL: Record<EvacuationAssistType, string> = {
  MOBILITY: 'Mobility',
  VISUAL: 'Visual',
  HEARING: 'Hearing',
  MEDICAL: 'Medical',
  OTHER: 'Other',
};

export function evacuationAssistLabel(
  types: readonly string[],
  other: string | null,
): string {
  return types
    .map((t) =>
      t === 'OTHER' && other
        ? `${LABEL.OTHER}: ${other}`
        : (LABEL[t as EvacuationAssistType] ?? t),
    )
    .join('; ');
}
