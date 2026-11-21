import {
  IJournalEntryAiProposal,
  IJournalHeaderAiProposal,
  IJournalLineAiProposal,
} from '@app/journal-entry/dtos/journal-entry-ai-proposal/journal-entry-proposals.dto';
import {
  journalEntryAiProposalDtoValidation,
  journalHeaderAiProposalDtoValidation,
  journalLineAiProposalDtoValidation,
} from '@app/journal-entry/dtos/journal-entry-ai-proposal/journal-entry-proposals.dto.validation';

const header = {
  temporaryId: 'entry-1',
  sourceType: 'payment',
  memo: null,
  effectiveDate: '2026-11-18',
} satisfies IJournalHeaderAiProposal;

const line = {
  temporaryId: 'line-1',
  accountTemporaryId: 'account-1',
  sequenceOrder: 1,
  amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
  exchangeRate: {
    baseCurrencyCode: 'USD',
    targetCurrencyCode: 'NGN',
    rate: 1500,
    type: 'official',
    asOf: new Date('2026-11-18T00:00:00Z'),
    source: 'statement',
  },
  side: 'credit',
  description: null,
  counterpartyTemporaryId: 'counterparty-1',
  functionalAmount: { amount: 150000, currencyCode: 'NGN', isMinorUnit: true },
} satisfies IJournalLineAiProposal;

describe('journalHeaderAiProposalDtoValidation', () => {
  it('accepts a resolved journal header proposal', () => {
    expect(journalHeaderAiProposalDtoValidation.parse(header)).toEqual(header);
  });

  it('accepts undetermined source type and effective date', () => {
    const input = {
      ...header,
      sourceType: '__undetermined__',
      effectiveDate: '__undetermined__',
    } satisfies IJournalHeaderAiProposal;

    expect(journalHeaderAiProposalDtoValidation.parse(input)).toEqual(input);
  });

  it.each([
    { temporaryId: null },
    { sourceType: 'unknown' },
    { memo: 1 },
    { effectiveDate: '2026-02-30' },
    { effectiveDate: undefined },
    { extra: true },
  ])('rejects invalid fields %j', (invalidFields) => {
    expect(
      journalHeaderAiProposalDtoValidation.safeParse({
        ...header,
        ...invalidFields,
      }).success
    ).toBe(false);
  });
});

describe('journalLineAiProposalDtoValidation', () => {
  it('accepts a resolved journal line proposal', () => {
    expect(journalLineAiProposalDtoValidation.parse(line)).toEqual(line);
  });

  it('accepts undetermined assessment fields', () => {
    const input = {
      ...line,
      accountTemporaryId: '__undetermined__',
      amount: '__undetermined__',
      exchangeRate: '__undetermined__',
      side: '__undetermined__',
      counterpartyTemporaryId: '__undetermined__',
      functionalAmount: '__undetermined__',
    } satisfies IJournalLineAiProposal;

    expect(journalLineAiProposalDtoValidation.parse(input)).toEqual(input);
  });

  it('accepts null exchange rate and counterparty reference', () => {
    const input = {
      ...line,
      exchangeRate: null,
      counterpartyTemporaryId: null,
    };

    expect(journalLineAiProposalDtoValidation.parse(input)).toEqual(input);
  });

  it.each([
    { temporaryId: 1 },
    { accountTemporaryId: null },
    { sequenceOrder: 0 },
    { sequenceOrder: 1.5 },
    { amount: { ...line.amount, amount: '100' } },
    { exchangeRate: { ...line.exchangeRate, rate: 0 } },
    { side: 'unknown' },
    { description: '' },
    { counterpartyTemporaryId: undefined },
    { functionalAmount: { ...line.functionalAmount, isMinorUnit: null } },
    { extra: true },
  ])('rejects invalid fields %j', (invalidFields) => {
    expect(
      journalLineAiProposalDtoValidation.safeParse({
        ...line,
        ...invalidFields,
      }).success
    ).toBe(false);
  });
});

describe('journalEntryAiProposalDtoValidation', () => {
  const proposal = {
    ...header,
    lines: [line],
  } satisfies IJournalEntryAiProposal;

  it('accepts a journal entry proposal with nested lines', () => {
    expect(journalEntryAiProposalDtoValidation.parse(proposal)).toEqual(
      proposal
    );
  });

  it.each([
    { effectiveDate: null },
    { lines: undefined },
    { lines: [line, { ...line, sequenceOrder: -1 }] },
    { extra: true },
  ])('rejects invalid fields %j', (invalidFields) => {
    expect(
      journalEntryAiProposalDtoValidation.safeParse({
        ...proposal,
        ...invalidFields,
      }).success
    ).toBe(false);
  });
});
