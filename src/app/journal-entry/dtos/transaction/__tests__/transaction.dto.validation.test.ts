import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';

import { journalEntryReqValidation } from '@app/journal-entry/dtos/transaction/transaction.dto.validation';

describe('Transaction DTO Validation', () => {
  it('should validate a correct transaction request payload', () => {
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
      sourceType: EJournalEntrySourceType.Payment,
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
      status: EJournalEntryStatus.Posted,
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: new Date('2026-07-13T18:00:00Z'),
      memo: 'Valid memo string',
    };

    const result = journalEntryReqValidation.safeParse(payload);
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
      sourceType: EJournalEntrySourceType.Payment,
      destinationLines: [],
      status: EJournalEntryStatus.Draft,
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: null,
      memo: null,
    };

    const result = journalEntryReqValidation.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
