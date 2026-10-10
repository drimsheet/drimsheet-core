import { IReadRepoOptions } from '@shared/types/repo.types';

import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import getOppositeJournalSide from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import openingBalanceEntryRule from '@domain/journal-entry/rules/opening-balance-entry.rule';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import openingBalanceRevisionValidation from '@domain/journal-entry/services/validations/opening-balance-revision.validation';
import openingBalanceValidation from '@domain/journal-entry/services/validations/opening-balance.validation';
import {
  TAuditedJournalEntry,
  TAuditedJournalEntryUpdate,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLineMakePayload } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import openingBalanceCurrencyInvarianceRule from '@domain/ledger/rules/opening-balance-currency-invariance.rule';
import { EEquitySubType } from '@domain/ledger/types/equity-account.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';

import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import IOpeningBalanceEntryAppService, {
  IInitialOpeningBalancePayload,
  IOpeningBalanceEntryPayload,
  IOpeningBalanceJournalMutation,
} from '@app/journal-entry/contracts/opening-balance-entry.service.contract';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  journalEntryQueryRepo: IJournalEntryQueryRepo;
  accountingPeriodService: IAccountingPeriodService;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
  fxLotAppService: IFxLotAppService;
}

/**
 * Builds the two-sided opening journal from the configured equity account.
 * Reads existing balance adjustments and equity configuration using the caller's
 * repository options, then delegates validity checks and creation to domain
 * rules and entities. Draft accounts produce draft journals; active accounts
 * produce posted journals. Returns events and audits without persisting them.
 */
async function makeOpeningBalance(
  deps: IDependencies,
  payload: IInitialOpeningBalancePayload,
  repoOptions: IReadRepoOptions
) {
  const {
    accountingEntityId,
    account,
    functionalCurrencyCode,
    amount,
    effectiveDate,
    exchangeRate,
    createdBy,
  } = payload;

  const functionalCurrency = currencyEntity.getByCode(functionalCurrencyCode);

  openingBalanceCurrencyInvarianceRule.validate(account, amount.currency);

  const functionalAmount = exchangeRate
    ? moneyValue.convert(amount, exchangeRate, functionalCurrency)
    : amount;

  openingBalanceValidation.validatePostingAccount(account);

  const [existingBalanceAdjustment] =
    await deps.ledgerAccountBalanceRepo.findAdjustmentsByAccountId(
      account.id,
      repoOptions
    );

  openingBalanceValidation.validateNoBalanceAdjustments(
    account.id,
    Boolean(existingBalanceAdjustment)
  );

  const [equityAccount] = await deps.ledgerAccountRepo.findBySubType(
    accountingEntityId,
    ELedgerType.Equity,
    EEquitySubType.OpeningBalance,
    repoOptions
  );

  openingBalanceValidation.validateEquityAccount(equityAccount);

  journalEntryServiceValidation.validateAccountsAgainstRule(
    [account],
    [equityAccount],
    openingBalanceEntryRule
  );

  const postedAt =
    account.status === ELedgerAccountStatus.Draft ? null : effectiveDate;
  const headerValidationPayload = {
    accountingEntityId,
    effectiveDate,
    postedAt,
  };
  const accountValidationPayload = {
    account,
    amount,
  };
  const equityValidationPayload = {
    account: equityAccount,
    amount: functionalAmount,
  };
  journalEntryServiceValidation.validateAccounts(headerValidationPayload, [
    accountValidationPayload,
    equityValidationPayload,
  ]);

  const accountSide: IJournalLineMakePayload = {
    accountId: account.id,
    counterpartyId: null,
    functionalCurrency,
    amount,
    exchangeRate,
    sequenceOrder: 1,
    side: account.normalBalance,
    description: 'Opening balance',
  };

  const equitySide: IJournalLineMakePayload = {
    accountId: equityAccount.id,
    counterpartyId: null,
    functionalCurrency,
    amount: functionalAmount,
    exchangeRate: null,
    sequenceOrder: 2,
    description: null,
    side: getOppositeJournalSide(account.normalBalance),
  };

  return journalEntryEntity.make({
    accountingEntityId,
    sourceType: EJournalEntrySourceType.OpeningBalance,
    effectiveDate,
    postedAt,
    memo: 'Opening balance',
    createdBy,
    functionalCurrency,
    lines: [accountSide, equitySide],
  });
}

/**
 * Creates an initial journal for an unpersisted account within the caller's
 * transaction. Validates its opening date and posting period before building
 * the journal. Rejects invalid state or read failures; returns an audited
 * journal tuple without persistence, event publication or FX acquisition.
 */
function makeCreateInitialOpeningBalance(
  deps: IDependencies
): IOpeningBalanceEntryAppService['createInitialOpeningBalance'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new journalEntryError.InitialOpeningBalanceTransactionRequired();
    const { account } = payload;
    openingBalanceValidation.validateInitialDate(
      account,
      payload.effectiveDate
    );
    const existing = await deps.ledgerAccountRepo.findById(
      account.id,
      account.accountingEntityId,
      repoOptions
    );
    openingBalanceValidation.validateUnpersistedAccount(
      account.id,
      Boolean(existing)
    );

    await deps.accountingPeriodService.validatePostingPeriod(
      payload.accountingEntityId,
      payload.effectiveDate,
      repoOptions
    );

    return makeOpeningBalance(deps, payload, repoOptions);
  };
}

/** Revises the draft aggregate in place, retaining entry and line identities.
 * Domain validation and period failures reject before any result is returned.
 * This operation only reads; the caller persists the returned audit and events.
 */
async function reviseOpeningBalanceEntry(
  deps: IDependencies,
  {
    originalEntry,
    ...payload
  }: IInitialOpeningBalancePayload & { originalEntry: IJournalEntry },
  repoOptions: IReadRepoOptions
) {
  openingBalanceRevisionValidation.validateSourceType(originalEntry);
  openingBalanceRevisionValidation.validateStatus(originalEntry);
  openingBalanceRevisionValidation.validateAccountAssociation(
    originalEntry,
    payload.account
  );

  await deps.accountingPeriodService.validatePostingPeriod(
    payload.accountingEntityId,
    payload.effectiveDate,
    repoOptions
  );

  const [revisedOpeningBalance] = await makeOpeningBalance(
    deps,
    {
      ...payload,
      account: {
        ...payload.account,
        openingBalanceDate: payload.effectiveDate,
      },
    },
    repoOptions
  );
  openingBalanceRevisionValidation.validateLineSequences(
    originalEntry,
    revisedOpeningBalance
  );
  const lines = revisedOpeningBalance.lines.map((line) => {
    const originalLine = originalEntry.lines.find(
      (candidate) => candidate.sequenceOrder === line.sequenceOrder
    )!;

    return Object.freeze({ ...line, id: originalLine.id });
  });

  return journalEntryEntity.update(
    originalEntry,
    {
      id: originalEntry.id,
      effectiveDate: revisedOpeningBalance.effectiveDate,
      postedAt: revisedOpeningBalance.postedAt,
      status: revisedOpeningBalance.status,
      lines,
    },
    payload.createdBy
  );
}

/** Maps the application request to the money and exchange-rate domain values. */
function getDomainPayload(payload: IOpeningBalanceEntryPayload) {
  return {
    accountingEntityId: payload.accountingEntity.id,
    functionalCurrencyCode: payload.accountingEntity.functionalCurrencyCode,
    account: payload.account,
    amount: moneyMapper.fromDto(payload.openingBalance.amount),
    effectiveDate: payload.openingBalance.date,
    exchangeRate: payload.openingBalance.exchangeRate
      ? exchangeRateValue.make(payload.openingBalance.exchangeRate)
      : null,
    createdBy: payload.actor,
  };
}

/** Rejects an existing opening date before building a new account opening journal. */
async function createOpeningBalance(
  deps: IDependencies,
  payload: IOpeningBalanceEntryPayload,
  repoOptions: IReadRepoOptions
) {
  openingBalanceValidation.validateNoOpeningBalance(payload.account);

  return makeOpeningBalance(deps, getDomainPayload(payload), repoOptions);
}

/**
 * Resolves FX acquisition records and selects posted journals for balance
 * propagation. FX failures reject; draft/non-FX handling belongs to the FX
 * capability. Returns effects for the use case without writes or queueing.
 */
async function getEntryEffects(
  deps: IDependencies,
  payload: IOpeningBalanceEntryPayload,
  journalEntry: IJournalEntry,
  repoOptions: IReadRepoOptions
) {
  const fxAcquisition = await deps.fxLotAppService.acquire(
    {
      journalEntry,
      account: payload.account,
      actor: payload.actor,
    },
    repoOptions
  );
  const entriesForBalancePropagation =
    journalEntry.status === EJournalEntryStatus.Posted ? [journalEntry] : [];

  return { fxAcquisition, entriesForBalancePropagation };
}

/** Packages an audited creation as a journal mutation for use-case persistence. */
function getCreationMutation(
  creation: TAuditedJournalEntry
): IOpeningBalanceJournalMutation {
  return {
    entriesToCreate: [creation],
    entryUpdate: null,
    events: creation[1],
  };
}

/**
 * Selects changed line versions and retains the original aggregate version for
 * optimistic persistence. A revision preserves every existing line identity.
 */
function getRevisionMutation(
  originalEntry: IJournalEntry,
  revision: TAuditedJournalEntryUpdate
): IOpeningBalanceJournalMutation {
  const [entry, events, audit] = revision;
  const linesToUpdate = entry.lines.filter((line) => {
    const originalLine = originalEntry.lines.find(
      (candidate) => candidate.id === line.id
    )!;

    return line.version !== originalLine.version;
  });

  return {
    entriesToCreate: [],
    entryUpdate: {
      entry,
      expectedVersion: originalEntry.version,
      headerAudit: audit.header,
      lineAudits: audit.lines,
      linesToCreate: [],
      linesToUpdate,
      lineIdsToDelete: [],
    },
    events,
  };
}

/** Returns the revised journal and its versioned persistence mutation. */
async function reviseOpeningBalance(
  deps: IDependencies,
  payload: IOpeningBalanceEntryPayload,
  originalEntry: IJournalEntry,
  repoOptions: IReadRepoOptions
) {
  const revision = await reviseOpeningBalanceEntry(
    deps,
    { originalEntry, ...getDomainPayload(payload) },
    repoOptions
  );

  return {
    mutation: getRevisionMutation(originalEntry, revision),
    currentJournalEntry: revision[0],
  };
}

/** Builds a new opening journal and packages its audited creation for persistence. */
async function createOpeningBalanceMutation(
  deps: IDependencies,
  payload: IOpeningBalanceEntryPayload,
  repoOptions: IReadRepoOptions
) {
  const creation = await createOpeningBalance(deps, payload, repoOptions);

  return {
    mutation: getCreationMutation(creation),
    currentJournalEntry: creation[0],
  };
}

/**
 * Reads the account's draft opening journal in the supplied read context and
 * chooses revision or creation. Domain and repository failures propagate.
 */
async function createOrReviseOpeningBalance(
  deps: IDependencies,
  payload: IOpeningBalanceEntryPayload,
  repoOptions: IReadRepoOptions
) {
  const draftOpeningBalances = await deps.journalEntryQueryRepo.findAll(
    payload.accountingEntity.id,
    {
      ...repoOptions,
      accountId: payload.account.id,
      status: EJournalEntryStatus.Draft,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      limit: 1,
    }
  );
  const originalEntry = draftOpeningBalances.data[0];

  if (originalEntry) {
    return reviseOpeningBalance(deps, payload, originalEntry, repoOptions);
  }

  return createOpeningBalanceMutation(deps, payload, repoOptions);
}

/**
 * Creates a new opening journal with its FX and balance-propagation effects.
 * Rejects an existing opening balance, invalid accounts, missing equity setup,
 * or read/FX failures. Uses caller-supplied read options and performs no writes,
 * event publication or queueing.
 */
function makeCreate(
  deps: IDependencies
): IOpeningBalanceEntryAppService['create'] {
  return async (payload, repoOptions) => {
    const creation = await createOpeningBalance(deps, payload, repoOptions);
    const entryEffects = await getEntryEffects(
      deps,
      payload,
      creation[0],
      repoOptions
    );

    return { creation, ...entryEffects };
  };
}

/**
 * Rejects historical posted activity, then creates or revises the account's
 * draft opening journal and resolves FX effects. Revision preserves aggregate
 * and line identities and validates the posting period. Reads use the caller's
 * options; the updating use case supplies its account-lock transaction.
 * Returns audited mutations and propagation candidates without persistence,
 * event publication or queueing. All validation, read and FX failures reject.
 */
function makeCreateOrRevise(
  deps: IDependencies
): IOpeningBalanceEntryAppService['createOrRevise'] {
  return async (payload, repoOptions) => {
    const hasPostedEntries =
      await deps.journalEntryQueryRepo.existsPostedByAccountId(
        payload.account.id,
        payload.accountingEntity.id,
        repoOptions
      );
    if (hasPostedEntries) {
      throw new ledgerAccountError.OpeningBalanceLocked({
        accountId: payload.account.id,
      });
    }

    const journalMutation = await createOrReviseOpeningBalance(
      deps,
      payload,
      repoOptions
    );
    const entryEffects = await getEntryEffects(
      deps,
      payload,
      journalMutation.currentJournalEntry,
      repoOptions
    );

    return { ...journalMutation, ...entryEffects };
  };
}

/** Binds the opening-balance application capabilities into an immutable service. */
export default function makeOpeningBalanceEntryAppService(
  deps: IDependencies
): IOpeningBalanceEntryAppService {
  return Object.freeze({
    createInitialOpeningBalance: makeCreateInitialOpeningBalance(deps),
    create: makeCreate(deps),
    createOrRevise: makeCreateOrRevise(deps),
  });
}
