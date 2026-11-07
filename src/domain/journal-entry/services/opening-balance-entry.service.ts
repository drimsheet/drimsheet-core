import { IReadRepoOptions } from '@shared/types/repo.types';

import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import getOppositeJournalSideHelper from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import openingBalanceEntryRule from '@domain/journal-entry/rules/opening-balance-entry.rule';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import openingBalanceRevisionValidation from '@domain/journal-entry/services/validations/opening-balance-revision.validation';
import openingBalanceValidation from '@domain/journal-entry/services/validations/opening-balance.validation';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLineMakePayload } from '@domain/journal-entry/types/journal-line.types';
import {
  IOpeningBalanceEntryService,
  IOpeningBalanceJournalPayload,
} from '@domain/journal-entry/types/opening-balance-entry.service.types';
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
import moneyValue from '@domain/money/values/money.vo';

interface IDependencies {
  journalEntryRepo: IJournalEntryRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
  accountingPeriodService: IAccountingPeriodService;
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
  payload: IOpeningBalanceJournalPayload,
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
    side: getOppositeJournalSideHelper(account.normalBalance),
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
 * Creates an audited journal for an account without a recorded opening date.
 * Draft accounts produce draft journals and active accounts produce postings.
 */
function makeCreate(
  deps: IDependencies
): IOpeningBalanceEntryService['create'] {
  return async (payload, repoOptions) => {
    openingBalanceValidation.validateNoOpeningBalance(payload.account);

    return makeOpeningBalance(deps, payload, repoOptions);
  };
}

/**
 * Creates an initial journal for an unpersisted account within the caller's
 * transaction. Validates its opening date and posting period before building
 * the journal. Rejects invalid state or read failures; returns an audited
 * journal tuple without persistence, event publication or FX acquisition.
 */
function makeCreateInitial(
  deps: IDependencies
): IOpeningBalanceEntryService['createInitial'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx) {
      throw new journalEntryError.InitialOpeningBalanceTransactionRequired();
    }
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

/**
 * Revises the draft in place, preserving entry and line identities. Rejects
 * invalid state or a closed posting period before returning the audited result.
 */
async function reviseDraft(
  deps: IDependencies,
  payload: IOpeningBalanceJournalPayload,
  originalEntry: IJournalEntry,
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

/**
 * Prepares an opening journal change under the caller's account lock. Rejects
 * historical postings before looking for a draft and propagates read failures.
 */
function makeCreateOrRevise(
  deps: IDependencies
): IOpeningBalanceEntryService['createOrRevise'] {
  const create = makeCreate(deps);

  return async (payload, repoOptions) => {
    const { account, accountingEntityId } = payload;
    const hasPostedEntries =
      await deps.journalEntryRepo.existsPostedByAccountId(
        account.id,
        accountingEntityId,
        repoOptions
      );
    if (hasPostedEntries) {
      throw new ledgerAccountError.OpeningBalanceLocked({
        accountId: account.id,
      });
    }

    const originalEntry =
      await deps.journalEntryRepo.findDraftOpeningBalanceByAccountId(
        account.id,
        accountingEntityId,
        repoOptions
      );
    if (!originalEntry) {
      const creation = await create(payload, repoOptions);
      const [currentJournalEntry, events] = creation;
      return {
        currentJournalEntry,
        entriesToCreate: [creation],
        entryUpdate: null,
        events,
      };
    }

    const revision = await reviseDraft(
      deps,
      payload,
      originalEntry,
      repoOptions
    );
    const [currentJournalEntry, events, audit] = revision;
    const entryUpdate = audit
      ? {
          entry: currentJournalEntry,
          expectedVersion: originalEntry.version,
          headerAudit: audit.header,
          lineAudits: audit.lines,
          linesToCreate: [],
          linesToUpdate: currentJournalEntry.lines.filter((line) =>
            audit.lines.some((lineAudit) => lineAudit.entityId === line.id)
          ),
          lineIdsToDelete: [],
        }
      : null;

    return { currentJournalEntry, entriesToCreate: [], entryUpdate, events };
  };
}

/**
 * Checks account eligibility and the posting period before preparing an
 * audited posting that preserves the draft's financial content and identity.
 */
function makePostDraft(
  deps: IDependencies
): IOpeningBalanceEntryService['postDraft'] {
  return async ({ entry, account, actor }, repoOptions) => {
    openingBalanceRevisionValidation.validateSourceType(entry);
    openingBalanceRevisionValidation.validateStatus(entry);
    openingBalanceRevisionValidation.validateAccountAssociation(entry, account);
    openingBalanceValidation.validateInitialDate(account, entry.effectiveDate);

    const counterpartIds = [
      ...new Set(
        entry.lines
          .filter((line) => line.accountId !== account.id)
          .map((line) => line.accountId)
      ),
    ];
    const counterparts = await deps.ledgerAccountRepo.findAllByIds(
      counterpartIds,
      entry.accountingEntityId,
      repoOptions
    );

    const journalLines = entry.lines.map((line) => {
      const lineAccount =
        line.accountId === account.id
          ? account
          : counterparts.find((candidate) => candidate.id === line.accountId);

      if (!lineAccount) {
        throw new journalEntryError.AccountNotFound({
          accountId: line.accountId,
        });
      }
      return { account: lineAccount, amount: line.amount };
    });

    journalEntryServiceValidation.validateAccountsAgainstRule(
      [account],
      counterparts,
      openingBalanceEntryRule
    );

    const postingDate = new Date();
    journalEntryServiceValidation.validateAccounts(
      {
        accountingEntityId: entry.accountingEntityId,
        effectiveDate: entry.effectiveDate,
        postedAt: postingDate,
      },
      journalLines
    );
    await deps.accountingPeriodService.validatePostingPeriod(
      entry.accountingEntityId,
      postingDate,
      repoOptions
    );

    return journalEntryEntity.update(
      entry,
      {
        id: entry.id,
        status: EJournalEntryStatus.Posted,
        postedAt: postingDate,
      },
      actor
    );
  };
}

export default function makeOpeningBalanceEntryService(
  deps: IDependencies
): IOpeningBalanceEntryService {
  const service: IOpeningBalanceEntryService = {
    create: makeCreate(deps),
    createInitial: makeCreateInitial(deps),
    createOrRevise: makeCreateOrRevise(deps),
    postDraft: makePostDraft(deps),
  };

  return Object.freeze(service);
}
