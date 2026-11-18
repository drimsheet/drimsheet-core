import { ILedgerAccountAiProposal } from '@app/ledger/dtos/ledger-account-ai-proposal/ledger-account-ai-proposal.dto';
import { ledgerAccountAiProposalDtoValidation } from '@app/ledger/dtos/ledger-account-ai-proposal/ledger-account-ai-proposal.dto.validation';

describe('ledgerAccountAiProposalDtoValidation', () => {
  const proposal = {
    temporaryId: 'account-1',
    name: 'Bank',
    type: 'asset',
    normalBalance: 'debit',
    subType: 'cash_and_cash_equivalent',
    behavior: 'bank',
  } satisfies ILedgerAccountAiProposal;

  it('accepts a resolved ledger account proposal', () => {
    expect(ledgerAccountAiProposalDtoValidation.parse(proposal)).toEqual(
      proposal
    );
  });

  it('accepts undetermined assessment fields', () => {
    const input = {
      ...proposal,
      name: '__undetermined__',
      type: '__undetermined__',
      normalBalance: '__undetermined__',
      subType: '__undetermined__',
      behavior: '__undetermined__',
    } satisfies ILedgerAccountAiProposal;

    expect(ledgerAccountAiProposalDtoValidation.parse(input)).toEqual(input);
  });

  it.each([
    { temporaryId: 1 },
    { name: null },
    { type: 'unknown' },
    { normalBalance: 'unknown' },
    { subType: 'unknown' },
    { behavior: undefined },
    { behavior: 'unknown' },
    { extra: true },
  ])('rejects invalid fields %j', (invalidFields) => {
    expect(
      ledgerAccountAiProposalDtoValidation.safeParse({
        ...proposal,
        ...invalidFields,
      }).success
    ).toBe(false);
  });
});
