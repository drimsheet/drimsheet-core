import { IReadRepoOptions } from '@shared/types/repo.types';

import {
  TAuditedJournalEntry,
  TAuditedJournalEntryUpdate,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  IOpeningBalanceEntryService,
  IOpeningBalanceJournalPayload,
} from '@domain/journal-entry/types/opening-balance-entry.service.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import IOpeningBalanceEntryAppService, {
  IOpeningBalanceEntryPayload,
  IOpeningBalanceJournalMutation,
} from '@app/journal-entry/contracts/opening-balance-entry.service.contract';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  journalEntryQueryRepo: IJournalEntryQueryRepo;
  openingBalanceEntryService: IOpeningBalanceEntryService;
  fxLotAppService: IFxLotAppService;
}

/** Maps the application request to the money and exchange-rate domain values. */
function getDomainPayload(
  payload: IOpeningBalanceEntryPayload
): IOpeningBalanceJournalPayload {
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
    entryUpdate: audit
      ? {
          entry,
          expectedVersion: originalEntry.version,
          headerAudit: audit.header,
          lineAudits: audit.lines,
          linesToCreate: [],
          linesToUpdate,
          lineIdsToDelete: [],
        }
      : null,
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
  const revision = await deps.openingBalanceEntryService.reviseDraft(
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
  const creation = await deps.openingBalanceEntryService.create(
    getDomainPayload(payload),
    repoOptions
  );

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
    const creation = await deps.openingBalanceEntryService.create(
      getDomainPayload(payload),
      repoOptions
    );
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
    create: makeCreate(deps),
    createOrRevise: makeCreateOrRevise(deps),
  });
}
