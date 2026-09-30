import { Pool } from 'pg';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';
import userEntity from '@domain/user/entities/user.entity';

import {
  mockAccountingEntityService,
  mockAccountingPeriodService,
} from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import makeCounterpartyAppService from '@app/counterparty/services/counterparty.service';
import mockFileManagementService from '@app/file/contracts/__mocks__/file-management.service.mock';
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import makeJournalEntryPersistenceService from '@app/journal-entry/services/journal-entry-persistence.service';
import makeJournalEntryRectificationPreparationService from '@app/journal-entry/services/journal-entry-rectification-preparation.service';
import makeCreatePaymentUsecase from '@app/journal-entry/usecases/create-payment.usecase';
import makeRectifyJournalEntryUsecase from '@app/journal-entry/usecases/rectify-journal-entry.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import mockOutboxService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';

import { ledgerAccountsInCore } from '@infra/config/drizzle/schema';
import { postgres } from '@infra/config/postgres.config';
import vars from '@infra/config/vars.config';
import accountingEntityRepo from '@infra/persistence/repos/accounting/accounting-entity.repo.impl';
import counterpartyRepo from '@infra/persistence/repos/counterparty/counterparty.repo.impl';
import journalRepos from '@infra/persistence/repos/journal-entry';
import ledgerAccountBalanceRepo from '@infra/persistence/repos/ledger/ledger-account-balance.repo.impl';
import ledgerAccountRepo from '@infra/persistence/repos/ledger/ledger-account.repo.impl';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';
import repoService from '@infra/services/repo.service';

// Exercise the real use-case transaction and persistence adapters. Only external
// effects and the unrelated posting-period/access capabilities are mocked.
describe('draft counterparties with real PostgreSQL', () => {
  const observer = new Pool({
    connectionString: vars.POSTGRES_URL,
    connectionTimeoutMillis: 2000,
  });
  const correlationId = 'draft-counterparties-db-spec';
  const repoOptions = { correlationId };
  const fixtures: Array<{
    entityId: TEntityId;
    actorId: TEntityId;
    userId: TEntityId;
  }> = [];
  const counterpartyAppService = makeCounterpartyAppService({
    counterpartyRepo,
    counterpartyService: makeCounterpartyService(),
  });
  const journalEntryService = makeJournalEntryService({
    accountingPeriodService: mockAccountingPeriodService,
    ledgerAccountRepo,
    ledgerAccountBalanceRepo,
  });
  const journalEntryPersistenceService = makeJournalEntryPersistenceService({
    repoService,
    journalEntryRepo: journalRepos.journalEntry,
    journalEntryHistoryRepo: journalRepos.journalEntryHistory,
    journalLineRepo: journalRepos.journalLine,
    journalLineHistoryRepo: journalRepos.journalLineHistory,
    journalEntryAttachmentRepo: journalRepos.journalEntryAttachment,
  });
  const journalEntryRectificationPreparationService =
    makeJournalEntryRectificationPreparationService({
      counterpartyAppService,
      journalEntryService,
      journalEntryRectificationService: makeJournalEntryRectificationService(),
      ledgerAccountRepo,
      fxLotAppService: mockFxLotAppService,
    });

  beforeAll(async () => {
    if (!vars.POSTGRES_URL)
      throw new Error('Select a migrated disposable *_test database');
    // Check the configured name before opening a connection or making any writes.
    expect(new URL(vars.POSTGRES_URL).pathname).toMatch(/_test$/);
    const state = await observer.query('select current_database() as database');
    expect(state.rows[0].database).toMatch(/_test$/);
  });
  beforeEach(() => {
    jest.resetAllMocks();
    mockFileManagementService.claimUploads.mockResolvedValue([]);
    mockFxLotAppService.dispose.mockResolvedValue(null);
    mockEventBus.publish.mockResolvedValue();
  });
  afterEach(async () => {
    for (const fixture of fixtures) {
      for (const table of [
        'audit.journal_line_history',
        'audit.journal_entry_history',
        'core.journal_entries',
        'audit.counterparty_history',
        'core.counterparties',
        'core.ledger_accounts',
      ]) {
        await observer.query(
          `delete from ${table} where accounting_entity_id = $1`,
          [fixture.entityId]
        );
      }
      await observer.query(
        'delete from core.accounting_entities where id = $1',
        [fixture.entityId]
      );
      await observer.query('delete from core.users where id = $1', [
        fixture.userId,
      ]);
      await observer.query('delete from core.actors where id = $1', [
        fixture.actorId,
      ]);
    }
    fixtures.length = 0;
  });
  afterAll(async () => {
    await observer.end();
    await postgres.$client.end();
  });

  async function setup() {
    const [actor] = actorEntity.makeUser({
      email: `draft-${generateUUID()}@example.test`,
      displayName: 'Draft test',
    });
    const [user] = userEntity.make({
      createdBy: actor.id,
      actorId: actor.id,
      email: actor.username,
      emailVerified: true,
      firstName: 'Draft',
      lastName: 'Test',
    });
    const entityId = generateUUID();
    fixtures.push({ entityId, actorId: actor.id, userId: user.id });
    await observer.query(
      "insert into core.actors (id,type,username,display_name,status,created_by,version) values ($1,'user',$2,'Draft test','active',$1,1)",
      [actor.id, actor.username]
    );
    await observer.query(
      "insert into core.users (id,actor_id,created_by,first_name,last_name,email,email_verified,version) values ($1,$2,$2,'Draft','Test',$3,true,1)",
      [user.id, actor.id, user.email]
    );
    await observer.query(
      "insert into core.accounting_entities (id,created_by,type,name,owner_id,functional_currency_code,jurisdiction_code) values ($1,$2,'individual','Draft test',$3,'NGN','NG')",
      [entityId, actor.id, user.id]
    );
    const accountingEntity = await accountingEntityRepo.findById(
      entityId,
      repoOptions
    );
    if (!accountingEntity) throw new Error('Missing fixture');
    mockAppContext.get.mockReturnValue({
      actor,
      user,
      accountingEntity,
      correlationId,
    });
    const accounts = (['bank', 'rent'] as const).map(
      (kind) =>
        ledgerAccountEntity.make({
          accountingEntityId: entityId,
          createdBy: actor.id,
          code: kind === 'bank' ? '100001' : '502001',
          materializedPath: kind === 'bank' ? '100001' : '502001',
          name: kind,
          type: kind === 'bank' ? 'asset' : 'expense',
          subType:
            kind === 'bank' ? 'cash_and_cash_equivalent' : 'rent_and_utilities',
          behavior: kind === 'bank' ? 'bank' : 'rent_and_utilities',
          normalBalance: 'debit',
          isControlAccount: false,
          controlAccountId: null,
          currency: SYSTEM_CURRENCIES.NGN,
          status: 'active',
          contraAccountRule: 'contra_permitted',
          adjunctAccountRule: 'adjunct_permitted',
          meta: {},
        })[0]
    );
    await postgres
      .insert(ledgerAccountsInCore)
      .values(accounts.map(ledgerAccountMapper.toRepo));
    const counterparty = {
      name: 'Draft supplier',
      type: 'organization' as const,
    };
    const line = {
      counterparty,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      description: null,
    };
    const payload: IPaymentEntryReq = {
      sourceLine: { ...line, accountId: accounts[0].id, sequenceOrder: 1 },
      destinationLines: [
        { ...line, accountId: accounts[1].id, sequenceOrder: 2 },
      ],
      effectiveDate: new Date('2026-09-01'),
      postedAt: null,
      memo: 'Draft test',
    };
    return { entityId, payload };
  }

  function create(transactionService = repoService) {
    return makeCreatePaymentUsecase({
      appContext: mockAppContext,
      counterpartyAppService,
      fileManagementService: mockFileManagementService,
      journalEntryService,
      ledgerAccountRepo,
      counterpartyRepo,
      journalEntryPersistenceService,
      repoService: transactionService,
      eventBus: mockEventBus,
      outboxService: mockOutboxService,
      ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
      fxLotAppService: mockFxLotAppService,
      fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
    });
  }
  const rectify = makeRectifyJournalEntryUsecase({
    accountingEntityService: mockAccountingEntityService,
    appContext: mockAppContext,
    counterpartyRepo,
    journalEntryRepo: journalRepos.journalEntry,
    journalEntryRectificationPreparationService,
    journalEntryPersistenceService,
    repoService,
    eventBus: mockEventBus,
    outboxService: mockOutboxService,
    ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
    fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
  });

  it('commits a draft and one deduplicated draft counterparty, exposes status and reuses its ID', async () => {
    const { entityId, payload } = await setup();
    const entry = await create()(payload);
    const counterparties = await counterpartyRepo.findAll(entityId, {
      ...repoOptions,
      status: 'draft',
    });
    expect(counterparties.data).toHaveLength(1);
    const counterparty = counterparties.data[0];
    expect(counterparty).toMatchObject({
      status: 'draft',
      type: 'organization',
      meta: {},
      roles: [],
    });
    const details = await journalRepos.queries.journalEntry.findById(
      entry.id as TEntityId,
      entityId,
      repoOptions
    );
    expect(
      details?.lines.every((line) => line.counterparty?.status === 'draft')
    ).toBe(true);
    expect(
      entry.lines.every((line) => line.counterpartyId === counterparty.id)
    ).toBe(true);
    payload.sourceLine.counterparty = {
      id: counterparty.id,
      name: counterparty.name,
    };
    payload.destinationLines[0].counterparty = payload.sourceLine.counterparty;
    await expect(create()(payload)).resolves.toMatchObject({ status: 'draft' });
    expect(
      (
        await counterpartyRepo.findAll(entityId, {
          ...repoOptions,
          status: 'draft',
        })
      ).data
    ).toHaveLength(1);
    expect(
      (
        await counterpartyRepo.findAll(entityId, {
          ...repoOptions,
          status: 'active',
        })
      ).data
    ).toHaveLength(0);
  });

  it('rolls back counterparties, journal lines and their histories when the outer save fails', async () => {
    const { entityId, payload } = await setup();
    const failure = new Error('failure after journal persistence');
    const transactionService: IRepoService = {
      runInTransaction: (fn) =>
        repoService.runInTransaction(async (tx) => {
          await fn(tx);
          throw failure;
        }),
    };
    await expect(create(transactionService)(payload)).rejects.toBe(failure);
    for (const table of [
      'core.counterparties',
      'audit.counterparty_history',
      'core.journal_entries',
      'audit.journal_entry_history',
      'audit.journal_line_history',
    ]) {
      const rows = await observer.query(
        `select count(*)::int as count from ${table} where accounting_entity_id = $1`,
        [entityId]
      );
      expect(rows.rows[0].count).toBe(0);
    }
    const lines = await observer.query(
      'select count(*)::int as count from core.journal_lines where account_id = $1',
      [payload.sourceLine.accountId]
    );
    expect(lines.rows[0].count).toBe(0);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects direct posting and draft-to-posted rectification without persistence or posting effects', async () => {
    const { entityId, payload } = await setup();
    const entry = await create()(payload);
    const counterpartyId = entry.lines[0].counterpartyId!;
    payload.sourceLine.counterparty = {
      id: counterpartyId,
      name: 'Draft supplier',
    };
    payload.destinationLines[0].counterparty = payload.sourceLine.counterparty;
    payload.postedAt = payload.effectiveDate;
    mockEventBus.publish.mockClear();
    mockFxLotAppService.dispose.mockClear();
    await expect(create()(payload)).rejects.toThrow(
      journalEntryError.DraftCounterpartyNotAllowed
    );
    await expect(
      rectify(entry.id, {
        ...payload,
        sourceType: 'payment',
        expectedVersion: entry.version,
        attachments: [],
      })
    ).rejects.toThrow(journalEntryError.DraftCounterpartyNotAllowed);
    const stored = await journalRepos.journalEntry.findById(
      entry.id as TEntityId,
      repoOptions
    );
    expect(stored).toMatchObject({
      status: 'draft',
      postedAt: null,
      version: entry.version,
    });
    expect(
      (
        await observer.query(
          'select id from core.journal_entries where accounting_entity_id = $1',
          [entityId]
        )
      ).rows
    ).toHaveLength(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
  });
  it('rejects introducing a draft counterparty through correction of a posted entry', async () => {
    const { entityId, payload } = await setup();
    const draftEntry = await create()(payload);
    const draftCounterpartyId = draftEntry.lines[0].counterpartyId!;
    payload.sourceLine.counterparty = {
      name: 'Active supplier',
      type: 'individual',
    };
    payload.destinationLines[0].counterparty = payload.sourceLine.counterparty;
    payload.postedAt = payload.effectiveDate;
    const postedEntry = await create()(payload);
    expect(postedEntry.status).toBe('posted');
    mockEventBus.publish.mockClear();
    mockFxLotAppService.dispose.mockClear();
    mockOutboxService.createBalancePropagation.mockClear();
    mockLedgerAccountBalanceAdjustmentQueue.add.mockClear();
    payload.destinationLines[0].counterparty = {
      id: draftCounterpartyId,
      name: 'Draft supplier',
    };
    await expect(
      rectify(postedEntry.id, {
        ...payload,
        sourceType: 'payment',
        expectedVersion: postedEntry.version,
        attachments: [],
      })
    ).rejects.toThrow(journalEntryError.DraftCounterpartyNotAllowed);
    expect(
      await journalRepos.journalEntry.findById(
        postedEntry.id as TEntityId,
        repoOptions
      )
    ).toMatchObject({ status: 'posted', version: postedEntry.version });
    const entries = await observer.query(
      'select id from core.journal_entries where accounting_entity_id = $1',
      [entityId]
    );
    expect(entries.rows).toHaveLength(2);
    const invalidReferences = await observer.query(
      "select l.id from core.journal_lines l join core.journal_entries j on j.id=l.entry_id join core.counterparties c on c.id=l.counterparty_id where j.accounting_entity_id=$1 and j.status='posted' and c.status='draft'",
      [entityId]
    );
    expect(invalidReferences.rows).toHaveLength(0);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });
});
