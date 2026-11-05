import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';

import { transactionJournalEntryReqValidation } from '@app/journal-entry/dtos/transaction-journal-entry/transaction-journal-entry.dto.validation';

describe('Transaction Journal Entry DTO Validation', () => {
  it('should validate a correct transaction journal entry request payload', () => {
    const payload = {
      sourceLine: {
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        counterpartyId: '3b4c1064-a09e-4e4f-b6a3-23945cc87f76',
        amount: {
          amount: 1000,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Source Line',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
          counterpartyId: null,
          amount: {
            amount: 1000,
            currencyCode: 'USD',
            isMinorUnit: true,
          },
          exchangeRate: null,
          description: 'Destination Line 1',
          sequenceOrder: 2,
        },
      ],
      status: EJournalEntryStatus.Draft,
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: null,
      memo: 'Valid memo',
    };

    const result = transactionJournalEntryReqValidation.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should fail validation if destinationLines is empty', () => {
    const payload = {
      sourceLine: {
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        amount: {
          amount: 1000,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Source Line',
        sequenceOrder: 1,
      },
      destinationLines: [],
      status: EJournalEntryStatus.Draft,
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: null,
      memo: null,
    };

    const result = transactionJournalEntryReqValidation.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
