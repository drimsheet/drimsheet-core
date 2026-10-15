import { TEntityId } from '@shared/types/uuid';

import getJournalEntryMemo from '@domain/journal-entry/entities/helpers/get-memo.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
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

    describe('getJournalEntryMemo', () => {
      it('should return null if value is empty or null', () => {
        expect(getJournalEntryMemo(undefined)).toBeNull();
        expect(getJournalEntryMemo(null)).toBeNull();
        expect(getJournalEntryMemo('')).toBeNull();
      });

      it('should throw an AppError if memo is too long', () => {
        const longMemo = 'a'.repeat(251);
        expect(() => getJournalEntryMemo(longMemo)).toThrow();
      });

      it('should return trimmed memo', () => {
        expect(getJournalEntryMemo('  valid memo  ')).toBe('valid memo');
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

    it('compares normalized memo values before rejecting posted accounting changes', () => {
      const entry = makeEntry(new Date('2026-04-01T00:00:00Z'));
      const [unchanged, events, audit] = journalEntryEntity.update(
        entry,
        { id: entry.id, memo: `  ${entry.memo}  ` },
        entry.createdBy
      );
      expect(unchanged).toBe(entry);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
      expect(() =>
        journalEntryEntity.update(
          entry,
          { id: entry.id, memo: 'Different' },
          entry.createdBy
        )
      ).toThrow(journalEntryError.RectificationNotPermitted);
    });

    it('returns an archived journal unchanged on repeated archival', () => {
      const [archived] = journalEntryEntity.archive(makeEntry(null));
      const [unchanged, events, audit] = journalEntryEntity.archive(archived);
      expect(unchanged).toBe(archived);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    });

    it('accepts an identical void retry but rejects conflicting or invalid lineage', () => {
      const entry = makeEntry(new Date('2026-04-01T00:00:00Z'));
      const payload = {
        voidingEntryId: 'f7930be4-f709-4cf2-bf2f-a885b22421fd' as TEntityId,
      };
      const [voided] = journalEntryEntity.void(entry, payload);
      const [unchanged, events, audit] = journalEntryEntity.void(
        voided,
        payload
      );
      expect(unchanged).toBe(voided);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
      expect(() =>
        journalEntryEntity.void(voided, { voidingEntryId: entry.id })
      ).toThrow(journalEntryError.InvalidStatusTransition);
      expect(() =>
        journalEntryEntity.void(voided, { voidingEntryId: 'bad' as TEntityId })
      ).toThrow(journalEntryError.InvalidVoidingEntryId);
    });

    function makeEntry(postedAt: Date | null) {
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
            amount: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
            exchangeRate: null,
            side: EJournalSide.Debit,
            description: 'Debit',
            functionalCurrency: SYSTEM_CURRENCIES.USD,
          },
          {
            accountId: 'e682fcb3-e6dc-54ed-9f7d-304c08c1b810' as TEntityId,
            sequenceOrder: 2,
            amount: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
            exchangeRate: null,
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

    it('should void a posted entry with lineage, audit, and event metadata', () => {
      const entry = makeEntry(new Date('2026-04-15T00:00:00.000Z'));
      const voidingEntryId =
        'f7930be4-f709-4cf2-bf2f-a885b22421fd' as TEntityId;
      const [voidedEntry, events, audit] = journalEntryEntity.void(entry, {
        voidingEntryId,
      });

      expect(voidedEntry).toMatchObject({
        id: entry.id,
        status: EJournalEntryStatus.Voided,
        voidedAt: new Date('2026-04-15T00:00:00.000Z'),
        voidingEntryId,
        version: 2,
      });
      expect(events).toEqual([
        expect.objectContaining({ type: EJournalEntryEvent.Voided }),
      ]);
      expect(audit?.action).toBe(EJournalEntryAuditAction.Voided);
      expect(audit?.diff.before).not.toHaveProperty('lines');
      expect(audit?.diff.after).not.toHaveProperty('attachments');
    });

    it('should reject voiding a draft entry', () => {
      const entry = makeEntry(null);

      expect(() =>
        journalEntryEntity.void(entry, {
          voidingEntryId: 'f7930be4-f709-4cf2-bf2f-a885b22421fd' as TEntityId,
        })
      ).toThrow(journalEntryError.InvalidStatusTransition);
    });

    it('should void a previously-posted archived entry', () => {
      const archivedEntry = {
        ...makeEntry(new Date('2026-04-15T00:00:00.000Z')),
        status: EJournalEntryStatus.Archived,
      };
      const voidingEntryId =
        'f7930be4-f709-4cf2-bf2f-a885b22421fd' as TEntityId;

      const [voidedEntry] = journalEntryEntity.void(archivedEntry, {
        voidingEntryId,
      });

      expect(voidedEntry).toMatchObject({
        id: archivedEntry.id,
        status: EJournalEntryStatus.Voided,
        postedAt: archivedEntry.postedAt,
        voidingEntryId,
      });
    });

    it('should reject voiding a never-posted archived entry', () => {
      const archivedEntry = {
        ...makeEntry(null),
        status: EJournalEntryStatus.Archived,
      };

      expect(() =>
        journalEntryEntity.void(archivedEntry, {
          voidingEntryId: 'f7930be4-f709-4cf2-bf2f-a885b22421fd' as TEntityId,
        })
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
