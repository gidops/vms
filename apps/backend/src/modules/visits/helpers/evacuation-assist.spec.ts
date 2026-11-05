import {
  evacuationAssistData,
  evacuationAssistLabel,
} from './evacuation-assist';

describe('evacuationAssistData', () => {
  it('keeps no types or text when no help is needed', () => {
    expect(
      evacuationAssistData({
        needsEvacuationAssist: false,
        evacuationAssistTypes: ['MOBILITY'],
        evacuationAssistOther: 'x',
      }),
    ).toEqual({ evacuationAssistTypes: [], evacuationAssistOther: null });
  });

  it('drops duplicates and keeps the text only with OTHER', () => {
    expect(
      evacuationAssistData({
        needsEvacuationAssist: true,
        evacuationAssistTypes: ['HEARING', 'HEARING'],
        evacuationAssistOther: 'ignored',
      }),
    ).toEqual({
      evacuationAssistTypes: ['HEARING'],
      evacuationAssistOther: null,
    });
    expect(
      evacuationAssistData({
        needsEvacuationAssist: true,
        evacuationAssistTypes: ['OTHER'],
        evacuationAssistOther: '  needs a ramp ',
      }),
    ).toEqual({
      evacuationAssistTypes: ['OTHER'],
      evacuationAssistOther: 'needs a ramp',
    });
  });
});

describe('evacuationAssistLabel', () => {
  it('lists the types, with the OTHER description', () => {
    expect(evacuationAssistLabel(['MOBILITY', 'OTHER'], 'ramp')).toBe(
      'Mobility; Other: ramp',
    );
    expect(evacuationAssistLabel([], null)).toBe('');
  });
});
