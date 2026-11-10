import { TEntityId } from '@shared/types/uuid';

import getJournalEntryMemoHelper from '@domain/journal-entry/entities/helpers/get-memo.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import journalEntryValidation from '@domain/journal-entry/entities/validations/journal-entry.validation';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntryEvent } from '@domain/journal-entry/events/journal-entry.events';
import { EJournalLineItemEvent } from '@domain/journal-entry/events/journal-line-item.events';
import {
  EJournalEntryAuditAction,
  EJournalLineAuditAction,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  UJournalEntrySourceType,
  UJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  EJournalSide,
  IJournalLine,
} from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';

type TMakePayload = Parameters<typeof journalEntryEntity.make>[0];

describe('JournalEntry Entity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-15T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const attachments = Array.from({ length: 4 }, (_, index) => ({
    url: `https://files.example.com/receipt-${index}.pdf`,
    name: `receipt-${index}.pdf`,
    type: 'application/pdf',
    size: 1024,
  }));

  describe('make', () => {
    let validPayload: TMakePayload;

    beforeEach(() => {
      validPayload = {
        accountingEntityId: '2b4c10ab-5c31-419b-ab29-688001d9f8e4' as TEntityId,
        sourceType: EJournalEntrySourceType.Expense,
        effectiveDate: new Date('2026-04-15T00:00:00.000Z'),
        memo: 'Test entry memo',
        functionalCurrency: SYSTEM_CURRENCIES.USD,
        postedAt: null,
        createdBy: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d' as TEntityId,
        attachments: [
          {
            url: 'https://files.example.com/receipt.png',
            name: 'Original receipt.png',
            type: 'image/png',
            size: 1024,
          },
        ],
        lines: [
          {
            accountId: 'd571fba2-d5cb-43dc-8e6c-2f3b97b0a70f' as TEntityId,
            counterpartyId: '3c5d72bc-1d2a-4a8b-8c0d-1e2f3a4b5c6d' as TEntityId,
            sequenceOrder: 1,
            amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.USD, false),
            exchangeRate: null,
            side: EJournalSide.Debit,
            description: 'Line item 1',
            functionalCurrency: SYSTEM_CURRENCIES.USD,
          },
          {
            accountId: 'e682fcb3-e6dc-54ed-9f7d-304c08c1b810' as TEntityId,
            counterpartyId: null,
            sequenceOrder: 2,
            amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.USD, false),
            exchangeRate: null,
            side: EJournalSide.Credit,
            description: 'Line item 2',
            functionalCurrency: SYSTEM_CURRENCIES.USD,
          },
        ],
      };
    });

    it.each([
      '123e4567-e89b-42d3-a456-426614174000' as TEntityId,
      '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
      'b2222222-2222-4222-8222-222222222222' as TEntityId,
      'c3333333-3333-4333-8333-333333333333' as TEntityId,
    ])('preserves immutable $type creation attribution', (createdBy) => {
      const [entity] = journalEntryEntity.make({ ...validPayload, createdBy });
      expect(entity.createdBy).toBe(createdBy);
      expect(Object.isFrozen(entity.createdBy)).toBe(true);
    });

    it('prepares draft deletion without changing the entry snapshot', () => {
      const [draft] = journalEntryEntity.make(validPayload);
      const before = structuredClone(draft);

      const [deletedEntry, event, audit] = journalEntryEntity.delete(draft);

      expect(deletedEntry).toBe(draft);
      expect(draft).toEqual(before);
      expect(Object.isFrozen(deletedEntry)).toBe(true);
      expect(event.type).toBe(EJournalEntryEvent.Deleted);
      expect(event.data).toBe(draft);
      expect(Object.isFrozen(event)).toBe(true);
      expect(audit).toBeNull();
    });

    it.each([
      EJournalEntryStatus.Posted,
      EJournalEntryStatus.Archived,
      EJournalEntryStatus.Voided,
    ])('rejects deletion of a %s entry', (status) => {
      const [draft] = journalEntryEntity.make(validPayload);

      expect(() => journalEntryEntity.delete({ ...draft, status })).toThrow(
        journalEntryError.DeletionNotPermitted
      );
    });

    it('rejects deletion of a draft with a posting date', () => {
      const [draft] = journalEntryEntity.make(validPayload);

      expect(() =>
        journalEntryEntity.delete({ ...draft, postedAt: new Date() })
      ).toThrow(journalEntryError.DeletionNotPermitted);
    });

    it('rejects deletion of a reversal draft', () => {
      const [draft] = journalEntryEntity.make({
        ...validPayload,
        sourceType: EJournalEntrySourceType.Reversal,
      });

      expect(() => journalEntryEntity.delete(draft)).toThrow(
        journalEntryError.DeletionNotPermitted
      );
    });

    it('should successfully create a journal entry with line items and events', () => {
      const [entry, events, audit] = journalEntryEntity.make(validPayload);

      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.accountingEntityId).toBe(validPayload.accountingEntityId);
      expect(entry.sourceType).toBe(validPayload.sourceType);
      expect(entry).not.toHaveProperty('counterpartyId');
      expect(entry.memo).toBe('Test entry memo');
      expect(entry.status).toBe(EJournalEntryStatus.Draft);
      expect(entry.effectiveDate).toEqual(validPayload.effectiveDate);
      expect(entry.postedAt).toBeNull();
      expect(entry.voidedAt).toBeNull();
      expect(entry.voidingEntryId).toBeNull();
      expect(entry.version).toBe(1);
      expect(entry.createdAt).toEqual(new Date('2026-04-15T00:00:00.000Z'));
      expect(entry.updatedAt).toEqual(new Date('2026-04-15T00:00:00.000Z'));
      expect(entry.createdBy).toBe(validPayload.createdBy);
      expect(entry.attachments).toEqual(validPayload.attachments);
      expect(Object.isFrozen(entry.attachments)).toBe(true);
      expect(Object.isFrozen(entry.attachments[0])).toBe(true);

      expect(entry.lines).toHaveLength(2);
      expect(entry.lines[0].entryId).toBe(entry.id);
      expect(entry.lines[0].accountId).toBe(validPayload.lines[0].accountId);
      expect(entry.lines[0].counterpartyId).toBe(
        validPayload.lines[0].counterpartyId
      );
      expect(entry.lines[1].entryId).toBe(entry.id);

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe(EJournalEntryEvent.Created);
      expect(events[0].data).toEqual(entry);
      expect(events[1].type).toBe(EJournalLineItemEvent.Created);
      expect(events[1].data).toEqual(entry.lines[0]);
      expect(events[2].type).toBe(EJournalLineItemEvent.Created);
      expect(events[2].data).toEqual(entry.lines[1]);

      expect(Object.isFrozen(entry)).toBe(true);
      expect(audit?.header.action).toBe(EJournalEntryAuditAction.Created);
      expect(audit?.header.diff.before).toBeNull();
      expect(audit?.header.diff.after).not.toHaveProperty('lines');
      expect(audit?.header.diff.after).not.toHaveProperty('attachments');
      expect(audit?.lines).toHaveLength(2);
      expect(audit?.lines[0]).toEqual({
        entityId: entry.lines[0].id,
        entityVersion: 1,
        action: EJournalLineAuditAction.Created,
        diff: {
          before: null,
          after: entry.lines[0],
        },
        occurredAt: entry.lines[0].updatedAt,
      });
    });

    it('should fall back to entry memo if line item description is absent', () => {
      const lineItemWithoutDesc = {
        ...validPayload.lines[0],
        description: null,
      };

      const payload: TMakePayload = {
        ...validPayload,
        lines: [lineItemWithoutDesc, validPayload.lines[1]],
      };

      const [entry] = journalEntryEntity.make(payload);

      expect(entry.lines[0].description).toBe('Test entry memo');
    });

    it('should default to an immutable empty attachment collection', () => {
      const [entry] = journalEntryEntity.make({
        ...validPayload,
        attachments: undefined,
      });

      expect(entry.attachments).toEqual([]);
      expect(Object.isFrozen(entry.attachments)).toBe(true);
    });

    it('allows three attachments and rejects a fourth on creation', () => {
      const [entry] = journalEntryEntity.make({
        ...validPayload,
        attachments: attachments.slice(0, 3),
      });
      expect(entry.attachments).toHaveLength(3);

      expect(() =>
        journalEntryEntity.make({ ...validPayload, attachments })
      ).toThrow(journalEntryError.InvalidAttachmentCount);
    });

    it('should create posted entries with the supplied posting date', () => {
      const payload: TMakePayload = {
        ...validPayload,
        postedAt: new Date('2026-04-16T00:00:00.000Z'),
      };

      const [entry] = journalEntryEntity.make(payload);

      expect(entry.postedAt).toEqual(payload.postedAt);
      expect(entry.voidedAt).toBeNull();
      expect(entry.voidingEntryId).toBeNull();
    });

    it('should throw an AppError if accountingEntityId is invalid', () => {
      expect(() =>
        journalEntryEntity.make({
          ...validPayload,
          accountingEntityId: 'invalid' as TEntityId,
        })
      ).toThrow(journalEntryError.InvalidAccountingEntityId);
    });

    it('should throw InvalidActor if createdBy is invalid', () => {
      expect(() =>
        journalEntryEntity.make({
          ...validPayload,
          createdBy: 'invalid' as unknown as TEntityId,
        })
      ).toThrow(journalEntryError.InvalidCreatedBy);
    });

    it('should throw an AppError if sourceType is invalid', () => {
      expect(() =>
        journalEntryEntity.make({
          ...validPayload,
          sourceType: 'invalid' as UJournalEntrySourceType,
        })
      ).toThrow();
    });

    it('should throw an AppError if effectiveDate is invalid', () => {
      expect(() =>
        journalEntryEntity.make({
          ...validPayload,
          effectiveDate: new Date('invalid'),
        })
      ).toThrow();
    });

    it('should throw an AppError if postedAt is invalid', () => {
      expect(() =>
        journalEntryEntity.make({
          ...validPayload,
          postedAt: new Date('invalid'),
        })
      ).toThrow();
    });

    it('should throw an AppError if there are only debits or only credits', () => {
      const payload: TMakePayload = {
        ...validPayload,
        lines: [
          validPayload.lines[0],
          {
            ...validPayload.lines[1],
            side: EJournalSide.Debit,
          },
        ],
      };

      expect(() => journalEntryEntity.make(payload)).toThrow();
    });

    it('should throw an AppError if total debits do not equal total credits', () => {
      const payload: TMakePayload = {
        ...validPayload,
        lines: [
          validPayload.lines[0],
          {
            ...validPayload.lines[1],
            amount: moneyValue.make(50.0, SYSTEM_CURRENCIES.USD, false),
          },
        ],
      };

      expect(() => journalEntryEntity.make(payload)).toThrow();
    });

    it('should reject balanced negative line amounts', () => {
      const negativeAmount = moneyValue.make(
        -100,
        SYSTEM_CURRENCIES.USD,
        false
      );
      const payload: TMakePayload = {
        ...validPayload,
        lines: validPayload.lines.map((line) => ({
          ...line,
          amount: negativeAmount,
        })),
      };

      expect(() => journalEntryEntity.make(payload)).toThrow(
        journalEntryError.InvalidJournalLineItem
      );
    });

    it('should accept balanced zero-value line amounts', () => {
      const zeroAmount = moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.USD);
      const payload: TMakePayload = {
        ...validPayload,
        lines: validPayload.lines.map((line) => ({
          ...line,
          amount: zeroAmount,
        })),
      };

      expect(() => journalEntryEntity.make(payload)).not.toThrow();
    });

    it('should throw an AppError if sequence orders are not unique', () => {
      const payload: TMakePayload = {
        ...validPayload,
        lines: [
          validPayload.lines[0],
          {
            ...validPayload.lines[1],
            sequenceOrder: validPayload.lines[0].sequenceOrder,
          },
        ],
      };

      expect(() => journalEntryEntity.make(payload)).toThrow();
    });

    it('should throw an AppError if there are less than 2 line items', () => {
      const payload: TMakePayload = {
        ...validPayload,
        lines: [validPayload.lines[0]],
      };

      expect(() => journalEntryEntity.make(payload)).toThrow();
    });

    it('should throw an AppError if there are no line items', () => {
      const payload: TMakePayload = {
        ...validPayload,
        lines: [],
      };

      expect(() => journalEntryEntity.make(payload)).toThrow();
    });

    it('should allow a transfer line with a valid counterparty', () => {
      const [entry] = journalEntryEntity.make({
        ...validPayload,
        sourceType: EJournalEntrySourceType.Transfer,
      });

      expect(entry.lines[0].counterpartyId).toBe(
        validPayload.lines[0].counterpartyId
      );
    });

    it('should reject an invalid line counterparty ID', () => {
      expect(() =>
        journalEntryEntity.make({
          ...validPayload,
          lines: [
            {
              ...validPayload.lines[0],
              counterpartyId: 'invalid' as TEntityId,
            },
            validPayload.lines[1],
          ],
        })
      ).toThrow();
    });
  });

  describe('Helpers', () => {
    describe('validateStatus', () => {
      it('should not throw for valid statuses', () => {
        expect(() =>
          journalEntryValidation.validateStatus(EJournalEntryStatus.Draft)
        ).not.toThrow();
        expect(() =>
          journalEntryValidation.validateStatus(EJournalEntryStatus.Posted)
        ).not.toThrow();
        expect(() =>
          journalEntryValidation.validateStatus(EJournalEntryStatus.Voided)
        ).not.toThrow();
      });

      it('should throw an AppError for an invalid status', () => {
        expect(() =>
          journalEntryValidation.validateStatus(
            'invalid' as UJournalEntryStatus
          )
        ).toThrow();
      });
    });

    describe('validateLine', () => {
      it('throws an AppError for an invalid side', () => {
        const item1: IJournalLine = {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id: '1' as TEntityId,
          entryId: '2' as TEntityId,
          accountId: '3' as TEntityId,
          counterpartyId: null,
          sequenceOrder: 1,
          amount: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
          exchangeRate: null,
          functionalAmount: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
          // @ts-expect-error Testing invalid side at runtime
          side: 'InvalidSide',
          description: 'test',
          meta: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const item2: IJournalLine = {
          ...item1,
          id: '4' as TEntityId,
          sequenceOrder: 2,
          side: EJournalSide.Credit,
        };

        expect(() =>
          journalEntryValidation.validateLine([item1, item2])
        ).toThrow();
      });
    });

    describe('getJournalEntryMemoHelper', () => {
      it('should return null if value is empty or null', () => {
        expect(getJournalEntryMemoHelper(undefined)).toBeNull();
        expect(getJournalEntryMemoHelper(null)).toBeNull();
        expect(getJournalEntryMemoHelper('')).toBeNull();
      });

      it('should throw an AppError if memo is too long', () => {
        const longMemo = 'a'.repeat(251);
        expect(() => getJournalEntryMemoHelper(longMemo)).toThrow();
      });

      it('should return trimmed memo', () => {
        expect(getJournalEntryMemoHelper('  valid memo  ')).toBe('valid memo');
      });
    });

    describe('validateSourceType', () => {
      it('should not throw for valid source types', () => {
        for (const sourceType of Object.values(EJournalEntrySourceType)) {
          expect(() =>
            journalEntryValidation.validateSourceType(sourceType)
          ).not.toThrow();
        }
      });

      it('should throw for an invalid source type', () => {
        expect(() =>
          journalEntryValidation.validateSourceType(
            'invalid' as UJournalEntrySourceType
          )
        ).toThrow();
      });
    });
  });

  describe('lifecycle transitions', () => {
    it('allows three attachments and rejects a fourth on update', () => {
      const entry = makeEntry(new Date('2026-04-01T00:00:00Z'));
      const [updated] = journalEntryEntity.update(
        entry,
        { id: entry.id, attachments: attachments.slice(0, 3) },
        entry.createdBy
      );
      expect(updated.attachments).toHaveLength(3);

      expect(() =>
        journalEntryEntity.update(
          updated,
          { id: updated.id, attachments },
          updated.createdBy
        )
      ).toThrow(journalEntryError.InvalidAttachmentCount);
    });
    it.each([null, new Date('2026-04-01T00:00:00Z')])(
      'preserves a journal for empty and equivalent updates (postedAt=%s)',
      (postedAt) => {
        const entry = makeEntry(postedAt);
        for (const changes of [
          { id: entry.id },
          {
            ...entry,
            effectiveDate: new Date(entry.effectiveDate),
            attachments: entry.attachments.map((item) => ({ ...item })),
            lines: entry.lines.map((line) => ({ ...line })),
          },
        ]) {
          const [unchanged, events, audit] = journalEntryEntity.update(
            entry,
            changes,
            entry.createdBy
          );
          expect(unchanged).toBe(entry);
          expect(unchanged.version).toBe(entry.version);
          expect(unchanged.updatedAt).toBe(entry.updatedAt);
          expect(events).toEqual([]);
          expect(audit).toBeNull();
        }
      }
    );

    it('compares normalized memo values before updating posted metadata', () => {
      const entry = makeEntry(new Date('2026-04-01T00:00:00Z'));
      const [unchanged, events, audit] = journalEntryEntity.update(
        entry,
        { id: entry.id, memo: `  ${entry.memo}  ` },
        entry.createdBy
      );
      expect(unchanged).toBe(entry);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
      const [updated] = journalEntryEntity.update(
        entry,
        { id: entry.id, memo: 'Different' },
        entry.createdBy
      );
      expect(updated.memo).toBe('Different');
    });

    it('returns an archived journal unchanged on repeated archival', () => {
      const [archived] = journalEntryEntity.archive(makeEntry(null));
      const [unchanged, events, audit] = journalEntryEntity.archive(archived);
      expect(unchanged).toBe(archived);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    });

    it('returns the linked void unchanged when void is repeated', () => {
      const entry = makeEntry(new Date('2026-04-01T00:00:00Z'));
      const {
        voided: [voidedEntry],
      } = journalEntryEntity.void(entry, entry.createdBy);
      const retry = journalEntryEntity.void(voidedEntry, entry.createdBy);

      expect(retry.voided[0]).toBe(voidedEntry);
      expect(retry.voided[1]).toEqual([]);
      expect(retry.voided[2]).toBeNull();
      expect(retry.reversal).toBeNull();
      expect(() =>
        journalEntryEntity.void(
          { ...voidedEntry, voidingEntryId: null },
          entry.createdBy
        )
      ).toThrow(journalEntryError.InvalidStatusTransition);
      expect(() =>
        journalEntryEntity.void(
          { ...voidedEntry, voidingEntryId: 'bad' as TEntityId },
          entry.createdBy
        )
      ).toThrow(journalEntryError.InvalidVoidingEntryId);
      expect(() =>
        journalEntryEntity.void(voidedEntry, 'bad' as TEntityId)
      ).toThrow(journalEntryError.InvalidCreatedBy);
    });

    function makeEntry(
      postedAt: Date | null,
      exchangeRate: ReturnType<typeof exchangeRateValue.make> | null = null
    ) {
      const currency = exchangeRate
        ? SYSTEM_CURRENCIES.NGN
        : SYSTEM_CURRENCIES.USD;

      return journalEntryEntity.make({
        accountingEntityId: '2b4c10ab-5c31-419b-ab29-688001d9f8e4' as TEntityId,
        sourceType: EJournalEntrySourceType.Expense,
        effectiveDate: new Date('2026-04-15T00:00:00.000Z'),
        postedAt,
        memo: 'Test entry memo',
        functionalCurrency: SYSTEM_CURRENCIES.USD,
        createdBy: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d' as TEntityId,
        attachments: [
          {
            url: 'https://files.example.com/receipt.pdf',
            name: 'receipt.pdf',
            type: 'application/pdf',
            size: 2048,
          },
        ],
        lines: [
          {
            accountId: 'd571fba2-d5cb-43dc-8e6c-2f3b97b0a70f' as TEntityId,
            sequenceOrder: 1,
            amount: moneyValue.make(100, currency, false),
            exchangeRate,
            side: EJournalSide.Debit,
            description: 'Debit',
            functionalCurrency: SYSTEM_CURRENCIES.USD,
          },
          {
            accountId: 'e682fcb3-e6dc-54ed-9f7d-304c08c1b810' as TEntityId,
            sequenceOrder: 2,
            amount: moneyValue.make(100, currency, false),
            exchangeRate,
            side: EJournalSide.Credit,
            description: 'Credit',
            functionalCurrency: SYSTEM_CURRENCIES.USD,
          },
        ],
      })[0];
    }

    it('updates every editable value on a draft journal entry', () => {
      const entry = makeEntry(null);
      const amount = moneyValue.make(150, SYSTEM_CURRENCIES.USD, false);
      const [updatedEntry, events, audit] = journalEntryEntity.update(
        entry,
        {
          id: entry.id,
          memo: 'Updated draft',
          lines: entry.lines.map((line) => ({
            ...line,
            amount,
            functionalAmount: amount,
          })),
        },
        'a1111111-1111-4111-8111-111111111111' as TEntityId
      );

      expect(updatedEntry).toMatchObject({
        id: entry.id,
        memo: 'Updated draft',
        version: 2,
      });
      expect(updatedEntry.lines).toEqual([
        expect.objectContaining({ id: entry.lines[0].id, version: 2 }),
        expect.objectContaining({ id: entry.lines[1].id, version: 2 }),
      ]);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: EJournalEntryEvent.Updated }),
          expect.objectContaining({ type: EJournalLineItemEvent.Updated }),
        ])
      );
      expect(audit?.header.action).toBe(EJournalEntryAuditAction.Updated);
      expect(audit?.lines).toHaveLength(2);
    });

    it('preserves unchanged lines and audits a new line through the entry update', () => {
      const entry = makeEntry(null);
      const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
      const [newLine] = journalLineEntity.make(
        {
          id: entry.id,
          memo: entry.memo,
          createdBy: actorId,
          createdAt: new Date(),
        },
        {
          accountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
          sequenceOrder: 3,
          amount: entry.lines[1].amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Replacement credit',
          functionalCurrency: SYSTEM_CURRENCIES.USD,
        }
      );

      const [updatedEntry, events, audit] = journalEntryEntity.update(
        entry,
        { id: entry.id, lines: [entry.lines[0], newLine] },
        actorId
      );

      expect(updatedEntry.lines[0]).toBe(entry.lines[0]);
      expect(updatedEntry.lines[1]).toEqual(newLine);
      expect(Object.isFrozen(updatedEntry.lines[1])).toBe(true);
      expect(updatedEntry.version).toBe(entry.version + 1);
      expect(events.map((event) => event.type)).toEqual([
        EJournalEntryEvent.Updated,
        EJournalLineItemEvent.Created,
      ]);
      expect(audit?.lines).toHaveLength(1);
      expect(audit?.lines[0]).toMatchObject({
        action: EJournalLineAuditAction.Created,
        diff: { before: null, after: newLine },
      });
    });

    it('updates only descriptions and attachments on a posted journal entry', () => {
      const entry = makeEntry(new Date('2026-04-15T00:00:00.000Z'));
      const attachments = [
        {
          url: 'https://files.example.com/corrected.pdf',
          name: 'corrected.pdf',
          type: 'application/pdf',
          size: 4096,
        },
      ];
      const [updatedEntry, , audit] = journalEntryEntity.update(
        entry,
        {
          id: entry.id,
          attachments,
          lines: entry.lines.map((line, index) => ({
            ...line,
            description:
              index === 0 ? 'Corrected description' : line.description,
          })),
        },
        'a1111111-1111-4111-8111-111111111111' as TEntityId
      );

      expect(updatedEntry.attachments).toEqual(attachments);
      expect(updatedEntry.lines[0].description).toBe('Corrected description');
      expect(updatedEntry.memo).toBe(entry.memo);
      expect(audit?.header.diff).toMatchObject({
        before: { attachments: entry.attachments },
        after: { attachments },
      });
    });

    it('uses the existing lines when lines are omitted and accepts explicit posting values', () => {
      const entry = makeEntry(null);
      const [updatedEntry] = journalEntryEntity.update(
        entry,
        {
          id: entry.id,
          postedAt: null,
        },
        'a1111111-1111-4111-8111-111111111111' as TEntityId
      );

      expect(updatedEntry.lines).toEqual(entry.lines);
      expect(updatedEntry.postedAt).toBeNull();
    });

    it('rejects accounting-value updates on a posted journal entry', () => {
      const entry = makeEntry(new Date('2026-04-15T00:00:00.000Z'));
      const amount = moneyValue.make(150, SYSTEM_CURRENCIES.USD, false);

      expect(() =>
        journalEntryEntity.update(
          entry,
          {
            id: entry.id,
            lines: entry.lines.map((line) => ({
              ...line,
              amount,
              functionalAmount: amount,
            })),
          },
          'a1111111-1111-4111-8111-111111111111' as TEntityId
        )
      ).toThrow(journalEntryError.RectificationNotPermitted);
    });

    it('returns an audited void and a reversal of the recorded FX lines', () => {
      const date = new Date('2026-04-15T00:00:00.000Z');
      const exchangeRate = exchangeRateValue.make({
        baseCurrencyCode: 'NGN',
        targetCurrencyCode: 'USD',
        rate: 0.01,
        asOf: new Date('2026-04-14T00:00:00.000Z'),
        type: EExchangeRateType.Official,
        source: 'Central bank',
      });
      const entry = makeEntry(date, exchangeRate);
      const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
      const { voided, reversal } = journalEntryEntity.void(entry, actorId);
      const [voidedEntry, events, audit] = voided;
      const [reversingEntry, reversalEvents, reversalAudit] = reversal!;

      expect(voidedEntry).toMatchObject({
        id: entry.id,
        status: EJournalEntryStatus.Voided,
        voidedAt: date,
        voidingEntryId: reversingEntry.id,
        version: 2,
      });
      expect(voidedEntry.lines).toBe(entry.lines);
      expect(entry.status).toBe(EJournalEntryStatus.Posted);
      expect(entry.voidingEntryId).toBeNull();
      expect(events).toEqual([
        expect.objectContaining({
          type: EJournalEntryEvent.Voided,
          data: voidedEntry,
        }),
      ]);
      expect(audit?.action).toBe(EJournalEntryAuditAction.Voided);
      expect(audit?.diff.before).not.toHaveProperty('lines');
      expect(audit?.diff.after).not.toHaveProperty('attachments');

      expect(reversingEntry).toMatchObject({
        accountingEntityId: entry.accountingEntityId,
        sourceType: EJournalEntrySourceType.Reversal,
        status: EJournalEntryStatus.Posted,
        effectiveDate: entry.effectiveDate,
        postedAt: date,
        createdBy: actorId,
      });
      expect(reversingEntry.id).not.toBe(entry.id);
      expect(reversingEntry.lines.map((line) => line.side)).toEqual([
        EJournalSide.Credit,
        EJournalSide.Debit,
      ]);
      for (const [index, originalLine] of entry.lines.entries()) {
        const reversedLine = reversingEntry.lines[index];
        expect(reversedLine).toMatchObject({
          entryId: reversingEntry.id,
          accountId: originalLine.accountId,
          counterpartyId: originalLine.counterpartyId,
          sequenceOrder: originalLine.sequenceOrder,
          amount: originalLine.amount,
          exchangeRate: originalLine.exchangeRate,
        });
        expect(reversedLine.id).not.toBe(originalLine.id);
        expect(reversedLine.functionalAmount).toBe(
          originalLine.functionalAmount
        );
      }
      expect(reversalEvents.map((event) => event.type)).toEqual([
        EJournalEntryEvent.Created,
        EJournalLineItemEvent.Created,
        EJournalLineItemEvent.Created,
      ]);
      expect(reversalAudit.header.action).toBe(
        EJournalEntryAuditAction.Created
      );
      expect(reversalAudit.lines).toHaveLength(entry.lines.length);
    });

    it('should reject voiding a draft entry', () => {
      const entry = makeEntry(null);

      expect(() => journalEntryEntity.void(entry, entry.createdBy)).toThrow(
        journalEntryError.InvalidStatusTransition
      );
    });

    it('rejects voiding a posted reversal', () => {
      const entry = makeEntry(new Date('2026-04-15T00:00:00.000Z'));
      const { reversal } = journalEntryEntity.void(entry, entry.createdBy);
      const [reversingEntry] = reversal!;

      expect(() =>
        journalEntryEntity.void(reversingEntry, entry.createdBy)
      ).toThrow(journalEntryError.RectificationNotPermitted);
    });

    it('should void a previously-posted archived entry', () => {
      const archivedEntry = {
        ...makeEntry(new Date('2026-04-15T00:00:00.000Z')),
        status: EJournalEntryStatus.Archived,
      };
      const {
        voided: [voidedEntry],
        reversal,
      } = journalEntryEntity.void(archivedEntry, archivedEntry.createdBy);

      expect(voidedEntry).toMatchObject({
        id: archivedEntry.id,
        status: EJournalEntryStatus.Voided,
        postedAt: archivedEntry.postedAt,
        voidingEntryId: reversal?.[0].id,
      });
    });

    it('should reject voiding a never-posted archived entry', () => {
      const archivedEntry = {
        ...makeEntry(null),
        status: EJournalEntryStatus.Archived,
      };

      expect(() =>
        journalEntryEntity.void(archivedEntry, archivedEntry.createdBy)
      ).toThrow(journalEntryError.InvalidStatusTransition);
    });

    it('should archive draft and posted entries with audit and event metadata', () => {
      const entry = makeEntry(new Date('2026-04-15T00:00:00.000Z'));

      const [archivedEntry, events, audit] = journalEntryEntity.archive(entry);

      expect(archivedEntry).toEqual(
        expect.objectContaining({
          status: EJournalEntryStatus.Archived,
          version: 2,
        })
      );
      expect(events).toEqual([
        expect.objectContaining({ type: EJournalEntryEvent.Archived }),
      ]);
      expect(archivedEntry.attachments).toBe(entry.attachments);
      expect(audit?.action).toBe(EJournalEntryAuditAction.Archived);
      expect(audit?.diff.before).not.toHaveProperty('attachments');
      expect(audit?.diff.after).not.toHaveProperty('attachments');
    });

    it('should archive a draft entry', () => {
      const [archivedEntry] = journalEntryEntity.archive(makeEntry(null));

      expect(archivedEntry.status).toBe(EJournalEntryStatus.Archived);
      expect(archivedEntry.postedAt).toBeNull();
    });

    it('should reject archiving a voided entry', () => {
      const entry = makeEntry(new Date('2026-04-15T00:00:00.000Z'));
      const voidedEntry = {
        ...entry,
        status: EJournalEntryStatus.Voided,
        voidedAt: new Date('2026-04-15T00:00:00.000Z'),
      };

      expect(() => journalEntryEntity.archive(voidedEntry)).toThrow(
        journalEntryError.InvalidStatusTransition
      );
    });
  });
});
