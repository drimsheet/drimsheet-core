import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import userEntity from '@domain/user/entities/user.entity';

import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

import journalEntryMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry.mapper';
import journalLineMapper from '@infra/persistence/repos/journal-entry/mappers/journal-line.mapper';

type TJournalEntrySelectModel = Parameters<
  typeof journalEntryMapper.toDomain
>[0];

describe('Journal Entry Mapper', () => {
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const makeEntry = async () => {
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'owner@example.com',
      emailVerified: true,
      firstName: 'Account',
      lastName: 'Owner',
    });
    const [accountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Owner Business',
      ownerId: user.id,
      type: EAccountingEntityType.Individual,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode: 'NG',
    });
    const [debitAccount] = await cashAccountService.createHeader(
      {
        name: 'Debit Cash',
        accountingEntity,
        createdBy: user.actorId,
      },
      { correlationId: 'test-correlation-id' }
    );
    const [creditAccount] = await cashAccountService.createHeader(
      {
        name: 'Credit Cash',
        accountingEntity,
        createdBy: user.actorId,
      },
      { correlationId: 'test-correlation-id' }
    );

    const amount = moneyValue.make(100_00, SYSTEM_CURRENCIES.NGN, true);

    return journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate: new Date('2026-05-01T00:00:00.000Z'),
      postedAt: new Date('2026-05-01T01:00:00.000Z'),
      memo: 'Cash transfer',
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      createdBy: user.actorId,
      lines: [
        {
          accountId: debitAccount.id,
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Debit cash',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: creditAccount.id,
          sequenceOrder: 2,
          amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Credit cash',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    })[0];
  };

  it.each([
    '123e4567-e89b-42d3-a456-426614174000' as TEntityId,
    '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
    'b2222222-2222-4222-8222-222222222222' as TEntityId,
    'c3333333-3333-4333-8333-333333333333' as TEntityId,
  ])(
    'round-trips complete $type attribution through JSON storage',
    async (createdBy) => {
      const entry = { ...(await makeEntry()), createdBy };
      const model = journalEntryMapper.toRepo(entry);
      const restored = journalEntryMapper.toDomain({
        ...model,
        postedAt: entry.postedAt?.toISOString() ?? null,
        voidedAt: null,
        journalEntryAttachmentsInCores: [],
        journalLinesInCores: entry.lines.map(journalLineMapper.toRepo),
        createdBy: JSON.parse(JSON.stringify(model.createdBy)),
      });
      expect(restored.createdBy).toEqual(createdBy);
    }
  );

  describe('toRepo', () => {
    it('maps a journal entry to a repo model', async () => {
      const entry = await makeEntry();

      expect(journalEntryMapper.toRepo(entry)).toEqual({
        id: entry.id,
        accountingEntityId: entry.accountingEntityId,
        sourceType: EJournalEntrySourceType.Transfer,
        memo: 'Cash transfer',
        status: EJournalEntryStatus.Posted,
        effectiveDate: entry.effectiveDate.toISOString(),
        postedAt: entry.postedAt?.toISOString(),
        voidedAt: null,
        voidingEntryId: null,
        version: 1,
        createdBy: entry.createdBy,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      });
    });

    it('maps nullable dates to repo null', async () => {
      const entry = {
        ...(await makeEntry()),
        postedAt: null,
        voidedAt: null,
      };

      expect(journalEntryMapper.toRepo(entry)).toMatchObject({
        postedAt: null,
        voidedAt: null,
      });
    });

    it('maps voidedAt to repo date string if present', async () => {
      const entry = {
        ...(await makeEntry()),
        voidedAt: new Date('2026-05-01T02:00:00.000Z'),
      };

      expect(journalEntryMapper.toRepo(entry)).toMatchObject({
        voidedAt: '2026-05-01T02:00:00.000Z',
      });
    });
  });

  describe('toDomain', () => {
    it('maps a journal entry select model to domain', async () => {
      const entry = await makeEntry();
      const model: TJournalEntrySelectModel = {
        ...journalEntryMapper.toRepo(entry),
        postedAt: entry.postedAt?.toISOString() ?? null,
        voidedAt: entry.voidedAt?.toISOString() ?? null,
        journalEntryAttachmentsInCores: [],
        journalLinesInCores: entry.lines.map(journalLineMapper.toRepo),
      };

      const result = journalEntryMapper.toDomain(model);
      expect(result).toEqual(entry);
      expect(Object.isFrozen(result.attachments)).toBe(true);
    });

    it('maps the persisted attachment collection', async () => {
      const entry = await makeEntry();
      const attachments = [
        {
          url: 'https://files.example.com/receipt.pdf',
          name: 'receipt.pdf',
          type: 'application/pdf',
          size: 2048,
        },
      ];
      const model: TJournalEntrySelectModel = {
        ...journalEntryMapper.toRepo(entry),
        postedAt: entry.postedAt?.toISOString() ?? null,
        voidedAt: entry.voidedAt?.toISOString() ?? null,
        journalEntryAttachmentsInCores: [
          {
            journalEntryId: entry.id,
            data: attachments,
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        journalLinesInCores: entry.lines.map(journalLineMapper.toRepo),
      };

      expect(journalEntryMapper.toDomain(model).attachments).toEqual(
        attachments
      );
    });

    it('maps nullable repo fields to domain null', async () => {
      const entry = await makeEntry();
      const model: TJournalEntrySelectModel = {
        ...journalEntryMapper.toRepo(entry),
        postedAt: null,
        voidedAt: null,
        journalEntryAttachmentsInCores: [],
        journalLinesInCores: entry.lines.map(journalLineMapper.toRepo),
      };

      expect(journalEntryMapper.toDomain(model)).toMatchObject({
        postedAt: null,
        voidedAt: null,
      });
    });

    it('maps truthy repo voidedAt to domain Date if present', async () => {
      const entry = {
        ...(await makeEntry()),
        voidedAt: new Date('2026-05-01T02:00:00.000Z'),
      };
      const model: TJournalEntrySelectModel = {
        ...journalEntryMapper.toRepo(entry),
        postedAt: entry.postedAt?.toISOString() ?? null,
        voidedAt: '2026-05-01T02:00:00.000Z',
        journalEntryAttachmentsInCores: [],
        journalLinesInCores: entry.lines.map(journalLineMapper.toRepo),
      };

      expect(journalEntryMapper.toDomain(model)).toEqual(entry);
    });
  });

  describe('toDto', () => {
    it('maps a journal entry to a DTO', async () => {
      const entry = await makeEntry();
      const dto = journalEntryMapper.toDto(entry);

      expect(dto).toMatchObject({
        id: entry.id,
        accountingEntityId: entry.accountingEntityId,
        sourceType: EJournalEntrySourceType.Transfer,
        memo: 'Cash transfer',
        status: EJournalEntryStatus.Posted,
        createdBy: entry.createdBy,
      });
      expect(dto).not.toHaveProperty('version');
      expect(dto.lines).toHaveLength(2);
      for (const line of dto.lines) expect(line).not.toHaveProperty('version');
    });
  });
});
