import { TEntityId } from '@shared/types/uuid';

import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';

import journalEntryDetailsMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry-details.mapper';

type TJournalEntryDetailsModel = Parameters<
  typeof journalEntryDetailsMapper.toDetails
>[0];

describe('Journal Entry Details Mapper', () => {
  const entryId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const userId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const accountId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
  const counterpartyId = '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
  const createdAt = '2026-09-16T09:00:00.000Z';
  const updatedAt = '2026-09-16T10:00:00.000Z';

  function makeModel(): TJournalEntryDetailsModel {
    return {
      id: entryId,
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Receipt,
      memo: 'Customer receipt',
      status: 'posted',
      effectiveDate: '2026-09-15',
      postedAt: createdAt,
      voidedAt: updatedAt,
      voidingEntryId: null,
      version: 1,
      createdBy: userId,
      createdAt,
      updatedAt,
      journalEntryAttachmentsInCores: [
        {
          journalEntryId: entryId,
          data: [
            {
              url: 'https://files.example.com/receipt.pdf',
              name: 'receipt.pdf',
              type: 'application/pdf',
              size: 2_048,
            },
          ],
          createdAt,
          updatedAt,
        },
      ],
      journalLinesInCores: [
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id: '123e4567-e89b-12d3-a456-426614174006',
          entryId,
          accountId,
          counterpartyId,
          sequenceOrder: 1,
          amount: 50_00,
          currencyCode: 'NGN',
          exchangeRate: null,
          functionalAmount: 50_00,
          functionalCurrencyCode: 'NGN',
          side: EJournalSide.Debit,
          description: 'Cash received',
          meta: { imported: true },
          version: 1,
          createdAt,
          updatedAt,
          ledgerAccountsInCore: { id: accountId, name: 'Cash' },
          counterpartiesInCore: {
            status: 'active',
            id: counterpartyId,
            name: 'Acme Ltd',
          },
        },
      ],
    };
  }

  it('maps persisted journal details with account and counterparty summaries', () => {
    const result = journalEntryDetailsMapper.toDetails(makeModel());

    expect(result).toMatchObject({
      id: entryId,
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Receipt,
      effectiveDate: new Date('2026-09-15T00:00:00.000Z'),
      postedAt: new Date(createdAt),
      voidedAt: new Date(updatedAt),
      attachments: [
        {
          url: 'https://files.example.com/receipt.pdf',
          name: 'receipt.pdf',
          type: 'application/pdf',
          size: 2_048,
        },
      ],
      lines: [
        {
          accountId,
          counterpartyId,
          account: { id: accountId, name: 'Cash' },
          counterparty: {
            status: 'active' as const,
            id: counterpartyId,
            name: 'Acme Ltd',
          },
          amount: {
            amount: 50_00n,
            currency: expect.objectContaining({ code: 'NGN' }),
          },
        },
      ],
    });
  });

  it('maps absent attachments, dates, and counterparty to empty or null values', () => {
    const model = makeModel();
    model.postedAt = null;
    model.voidedAt = null;
    model.journalEntryAttachmentsInCores = [];
    model.journalLinesInCores[0].counterpartyId = null;
    model.journalLinesInCores[0].counterpartiesInCore = null;

    expect(journalEntryDetailsMapper.toDetails(model)).toMatchObject({
      postedAt: null,
      voidedAt: null,
      attachments: [],
      lines: [
        {
          counterpartyId: null,
          counterparty: null,
        },
      ],
    });
  });
  it('maps the current draft counterparty status without changing the journal status', () => {
    const model = makeModel();
    model.journalLinesInCores[0].counterpartiesInCore!.status = 'draft';
    const entry = journalEntryDetailsMapper.toDetails(model);
    expect(entry.lines[0].counterparty?.status).toBe('draft');
    expect(entry.status).toBe(model.status);
  });
});
