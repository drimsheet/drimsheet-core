import { ICounterpartyAiProposal } from '@app/counterparty/dtos/counterparty-ai-proposal/counterparty-ai-proposal.dto';
import { counterpartyAiProposalDtoValidation } from '@app/counterparty/dtos/counterparty-ai-proposal/counterparty-ai-proposal.dto.validation';

describe('counterpartyAiProposalDtoValidation', () => {
  const address = {
    line1: '1 Sample Road',
    line2: null,
    city: 'Lagos',
    region: null,
    postalCode: null,
    countryCode: 'NG',
  };

  const proposal = {
    temporaryId: 'counterparty-1',
    name: 'Example Ltd',
    type: 'organization',
    roles: ['employer', 'vendor', 'contractor'],
    roleDetails: {
      employer: { displayName: null, address },
      vendor: { address: null },
      contractor: { address },
    },
  } satisfies ICounterpartyAiProposal;

  it('accepts a resolved counterparty proposal with role details', () => {
    expect(counterpartyAiProposalDtoValidation.parse(proposal)).toEqual(
      proposal
    );
  });

  it('accepts undetermined assessment fields with empty role details', () => {
    const input = {
      ...proposal,
      name: '__undetermined__',
      type: '__undetermined__',
      roles: '__undetermined__',
      roleDetails: {},
    } satisfies ICounterpartyAiProposal;

    expect(counterpartyAiProposalDtoValidation.parse(input)).toEqual(input);
  });

  it.each([
    { temporaryId: null },
    { name: ' ' },
    { type: 'unknown' },
    { roles: ['unknown'] },
    { roleDetails: undefined },
    { roleDetails: { unknown: {} } },
    { roleDetails: { employer: { address } } },
    { roleDetails: { vendor: {} } },
    { roleDetails: { contractor: { address: null } } },
    { roleDetails: { vendor: { address: { ...address, region: undefined } } } },
    { extra: true },
  ])('rejects invalid fields %j', (invalidFields) => {
    expect(
      counterpartyAiProposalDtoValidation.safeParse({
        ...proposal,
        ...invalidFields,
      }).success
    ).toBe(false);
  });
});
