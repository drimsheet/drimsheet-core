import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';

import { EJournalEntrySortBy } from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import {
  getJournalEntriesQueryValidationSchema,
  journalEntrySideValidation,
  journalEntrySourceTypeValidation,
  journalEntryStatusValidation,
  journalLineReqValidation,
} from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

describe('Journal Entry DTO Validation', () => {
  describe('getJournalEntriesQueryValidationSchema', () => {
    it('validates pagination and line participation filters', () => {
      const result = getJournalEntriesQueryValidationSchema.safeParse({
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        counterpartyId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
        page: 2,
        limit: 25,
        orderBy: EJournalEntrySortBy.EffectiveDate,
        status: EJournalEntryStatus.Archived,
        sortDirection: 'asc',
        search: 'invoice',
      });

      expect(result.success).toBe(true);
    });

    it.each([
      { createdAtFrom: '2026-09-01T00:00:00Z' },
      { createdAtTo: '2026-10-01T00:00:00Z' },
      { effectiveDateFrom: '2026-09-01' },
      { effectiveDateTo: '2026-09-30' },
      { updatedAtFrom: '2026-09-01T00:00:00+01:00' },
      { updatedAtTo: '2026-10-01T00:00:00+01:00' },
      { currencyCode: 'NGN' },
      { accountType: 'asset' },
    ])('accepts individual filters and open-ended ranges: %j', (query) => {
      expect(
        getJournalEntriesQueryValidationSchema.safeParse(query).success
      ).toBe(true);
    });

    it.each([
      ['createdAt', 'From'],
      ['createdAt', 'To'],
      ['updatedAt', 'From'],
      ['updatedAt', 'To'],
    ] as const)(
      'accepts up to milliseconds and rejects excess precision for %s.%s',
      (field, side) => {
        for (const timezone of ['Z', '+01:00', '-05:30']) {
          for (const fraction of ['', '.1', '.12', '.123']) {
            const query = {
              [`${field}${side}`]: `2026-09-01T12:30:00${fraction}${timezone}`,
            };
            expect(
              getJournalEntriesQueryValidationSchema.safeParse(query).success
            ).toBe(true);
          }
          for (const fraction of ['.1234', '.000999', '.000000000']) {
            const query = {
              [`${field}${side}`]: `2026-09-01T12:30:00${fraction}${timezone}`,
            };
            const parsed =
              getJournalEntriesQueryValidationSchema.safeParse(query);
            expect(parsed.success).toBe(false);
            expect(parsed.error?.issues).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  path: [`${field}${side}`],
                  message: 'date_error_date_invalid',
                }),
              ])
            );
          }
        }
      }
    );

    it.each(['createdAt', 'updatedAt'] as const)(
      'rejects reversed sub-millisecond %s bounds before truncation',
      (field) => {
        expect(
          getJournalEntriesQueryValidationSchema.safeParse({
            [`${field}From`]: '2026-09-01T00:00:00.000999Z',
            [`${field}To`]: '2026-09-01T00:00:00.000001Z',
          }).success
        ).toBe(false);
      }
    );

    it.each(['createdAt', 'updatedAt'] as const)(
      'compares %s bounds as instants across timezone offsets',
      (field) => {
        expect(
          getJournalEntriesQueryValidationSchema.safeParse({
            [`${field}From`]: '2026-09-01T10:00:00+02:00',
            [`${field}To`]: '2026-09-01T09:00:00Z',
          }).success
        ).toBe(true);
        expect(
          getJournalEntriesQueryValidationSchema.safeParse({
            [`${field}From`]: '2026-09-01T09:00:00Z',
            [`${field}To`]: '2026-09-01T10:00:00+02:00',
          }).success
        ).toBe(false);
      }
    );

    it.each([
      ['createdAt', '2026-09-01T00:00:00Z', '2026-08-01T00:00:00Z'],
      ['updatedAt', '2026-09-01T00:00:00Z', '2026-08-01T00:00:00Z'],
      ['effectiveDate', '2026-09-01', '2026-08-01'],
    ])('validates ordered inclusive %s bounds', (field, from, to) => {
      expect(
        getJournalEntriesQueryValidationSchema.safeParse({
          [`${field}From`]: from,
          [`${field}To`]: from,
        }).success
      ).toBe(true);
      const result = getJournalEntriesQueryValidationSchema.safeParse({
        [`${field}From`]: from,
        [`${field}To`]: to,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: [`${field}To`] }),
        ])
      );
    });

    it.each(Object.values(EJournalEntrySourceType))(
      'accepts only listable source types: %s',
      (sourceType) => {
        const result = getJournalEntriesQueryValidationSchema.safeParse({
          sourceType,
        });
        expect(result.success).toBe(
          sourceType !== EJournalEntrySourceType.Reversal
        );
      }
    );

    it('validates an empty query', () => {
      expect(getJournalEntriesQueryValidationSchema.safeParse({}).success).toBe(
        true
      );
    });

    it('accepts posted journal entries', () => {
      expect(
        getJournalEntriesQueryValidationSchema.safeParse({
          status: EJournalEntryStatus.Posted,
        }).success
      ).toBe(true);
    });

    it.each([
      [{ accountId: 'invalid-account-id' }],
      [{ sourceType: 'invalid-source' }],
      [{ sourceType: '' }],
      [{ createdAtRange: { from: '2026-09-01T00:00:00Z' } }],
      [{ effectiveDateRange: '2026-09-01' }],
      [{ effectiveDateRange: { from: ['2026-09-01'] } }],
      [{ effectiveDateRange: { until: '2026-09-01' } }],
      [{ effectiveDateFrom: '' }],

      [{ createdAtFrom: 'invalid' }],
      [{ createdAtTo: 'invalid' }],
      [{ effectiveDateFrom: 'invalid' }],
      [{ effectiveDateTo: 'invalid' }],
      [{ updatedAtFrom: 'invalid' }],
      [{ updatedAtTo: 'invalid' }],
      [{ currencyCode: 'invalid' }],
      [{ accountType: 'invalid' }],
      [{ createdAtFrom: '2026-09-01' }],
      [{ createdAtFrom: '0000-01-01T00:00:00Z' }],
      [{ updatedAtTo: '2026-09-01T10:00:00' }],
      [{ effectiveDateFrom: '2026-02-30' }],
      [{ effectiveDateTo: '0000-01-01' }],

      [{ counterpartyId: 'invalid-counterparty-id' }],
      [{ page: 0 }],
      [{ limit: 0 }],
      [{ orderBy: 'memo' }],
      [{ status: EJournalEntryStatus.Draft }],
      [{ status: EJournalEntryStatus.Voided }],
      [{ status: 'invalid-status' }],
    ])('rejects invalid query values', (query) => {
      expect(
        getJournalEntriesQueryValidationSchema.safeParse(query).success
      ).toBe(false);
    });
  });

  describe('journalEntrySourceTypeValidation', () => {
    it('should validate valid source types', () => {
      expect(
        journalEntrySourceTypeValidation.safeParse(EJournalEntrySourceType.Sale)
          .success
      ).toBe(true);
      expect(
        journalEntrySourceTypeValidation.safeParse(
          EJournalEntrySourceType.Purchase
        ).success
      ).toBe(true);
    });

    it('should fail on invalid source type', () => {
      expect(
        journalEntrySourceTypeValidation.safeParse('invalid_source').success
      ).toBe(false);
    });
  });

  describe('journalEntrySideValidation', () => {
    it('should validate valid sides', () => {
      expect(
        journalEntrySideValidation.safeParse(EJournalSide.Debit).success
      ).toBe(true);
      expect(
        journalEntrySideValidation.safeParse(EJournalSide.Credit).success
      ).toBe(true);
    });

    it('should fail on invalid side', () => {
      expect(journalEntrySideValidation.safeParse('invalid_side').success).toBe(
        false
      );
    });
  });

  describe('journalEntryStatusValidation', () => {
    it('should validate valid statuses', () => {
      expect(
        journalEntryStatusValidation.safeParse(EJournalEntryStatus.Draft)
          .success
      ).toBe(true);
      expect(
        journalEntryStatusValidation.safeParse(EJournalEntryStatus.Posted)
          .success
      ).toBe(true);
    });

    it('should fail on invalid status', () => {
      expect(
        journalEntryStatusValidation.safeParse('invalid_status').success
      ).toBe(false);
    });
  });

  describe('journalLineReqValidation', () => {
    it('should validate a correct journal line payload', () => {
      const payload = {
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        counterparty: {
          id: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
          name: 'Acme Corp',
        },
        amount: {
          amount: 1500,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Test transaction description',
        sequenceOrder: 1,
      };

      const result = journalLineReqValidation.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should validate correct payload with optional exchangeRate', () => {
      const payload = {
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        counterparty: null,
        amount: {
          amount: 1500,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: {
          baseCurrencyCode: 'EUR',
          targetCurrencyCode: 'USD',
          rate: 1.1,
          type: 'market',
          asOf: '2026-07-13T18:00:00Z',
          source: 'OpenExchange',
        },
        description: null,
        sequenceOrder: 2,
      };

      const result = journalLineReqValidation.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should validate a named counterparty without an ID', () => {
      const result = journalLineReqValidation.safeParse({
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        counterparty: { name: 'New supplier' },
        amount: {
          amount: 1500,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'New counterparty transaction',
        sequenceOrder: 1,
      });

      expect(result.success).toBe(true);
    });

    it('should fail validation on invalid counterparty UUID', () => {
      const result = journalLineReqValidation.safeParse({
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        counterparty: {
          id: 'invalid-counterparty-id',
          name: 'Acme Corp',
        },
        amount: {
          amount: 1500,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Test transaction description',
        sequenceOrder: 1,
      });

      expect(result.success).toBe(false);
    });

    it('should fail validation on invalid account UUID', () => {
      const payload = {
        accountId: 'invalid-uuid',
        amount: {
          amount: 1500,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Test description',
        sequenceOrder: 1,
      };

      const result = journalLineReqValidation.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should fail validation if description is too long', () => {
      const payload = {
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        amount: {
          amount: 1500,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'a'.repeat(101),
        sequenceOrder: 1,
      };

      const result = journalLineReqValidation.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should fail validation if description is empty string', () => {
      const payload = {
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        amount: {
          amount: 1500,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: '',
        sequenceOrder: 1,
      };

      const result = journalLineReqValidation.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should fail validation if sequenceOrder is not positive', () => {
      const payload = {
        accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
        amount: {
          amount: 1500,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Test',
        sequenceOrder: 0,
      };

      const result = journalLineReqValidation.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
