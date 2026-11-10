import { ERepoLock, IReadRepoOptions } from '@shared/types/repo.types';
import dateUtils from '@shared/utils/date';

import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import getOppositeJournalSideHelper from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import openingBalanceEntryRule from '@domain/journal-entry/rules/opening-balance-entry.rule';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import openingBalanceRevisionValidation from '@domain/journal-entry/services/validations/opening-balance-revision.validation';
import openingBalanceValidation from '@domain/journal-entry/services/validations/opening-balance.validation';
import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
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
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import openingBalanceCurrencyInvarianceRule from '@domain/ledger/rules/opening-balance-currency-invariance.rule';
import { EEquitySubType } from '@domain/ledger/types/equity-account.types';
import { ELedgerType } from '@domain/ledger/types/ledger.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import moneyValue from '@domain/money/values/money.vo';

interface IDependencies {
  journalEntryRepo: IJournalEntryRepo;
  journalEntryService: IJournalEntryService;
  ledgerAccountRepo: ILedgerAccountRepo;
  accountingPeriodService: IAccountingPeriodService;
}

/**
 * Builds the two-sided opening journal from the configured equity account.
 * Checks the configured accounts and returns the journal, events, and audit.
 */
async function makeOpeningBalance(
  deps: IDependencies,
  payload: IOpeningBalanceJournalPayload &
    Partial<Pick<IJournalEntry, 'memo' | 'attachments'>>,
  postedAt: Date | null,
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
    memo = 'Opening balance',
    attachments,
  } = payload;

  const functionalCurrency = currencyEntity.getByCode(functionalCurrencyCode);

  openingBalanceCurrencyInvarianceRule.validate(account, amount.currency);

  const functionalAmount = exchangeRate
    ? moneyValue.convert(amount, exchangeRate, functionalCurrency)
    : amount;

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

  const headerValidationPayload = {
    accountingEntityId,
    effectiveDate: postedAt === null ? undefined : effectiveDate,
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
    memo,
    attachments,
    createdBy,
    functionalCurrency,
    lines: [accountSide, equitySide],
  });
}

/** Creates a posted opening journal after checking posting eligibility. */
function makeCreate(
  deps: IDependencies
): IOpeningBalanceEntryService['create'] {
  return async (payload, repoOptions) => {
    const { account, accountingEntityId, effectiveDate } = payload;
    openingBalanceValidation.validatePostingAccount(account);
    if (account.openingBalanceDate !== null) {
      openingBalanceValidation.validateOpeningDateMatch(account, effectiveDate);
    }

    const hasOpeningJournal =
      await deps.journalEntryRepo.existsOpeningBalanceByAccountId(
        account.id,
        accountingEntityId,
        repoOptions
      );
    if (hasOpeningJournal) {
      throw new journalEntryError.ExistingOpeningBalance({
        accountId: account.id,
      });
    }

    dateUtils.validateDate(
      effectiveDate,
      journalEntryError.InvalidEffectiveDate
    );

    const hasEarlierPosting =
      await deps.journalEntryRepo.existsPostedByAccountId(
        account.id,
        accountingEntityId,
        repoOptions,
        effectiveDate
      );
    if (hasEarlierPosting) {
      throw new ledgerAccountError.OpeningBalanceLocked({
        accountId: account.id,
      });
    }

    const periodReadOptions = repoOptions.tx
      ? { ...repoOptions, lock: ERepoLock.Share }
      : repoOptions;
    await deps.accountingPeriodService.validatePostingPeriod(
      accountingEntityId,
      effectiveDate,
      periodReadOptions
    );

    return makeOpeningBalance(deps, payload, effectiveDate, repoOptions);
  };
}

/** Creates a draft opening journal after checking for an existing opening journal. */
function makeCreateDraft(
  deps: IDependencies
): IOpeningBalanceEntryService['createDraft'] {
  return async (payload, repoOptions) => {
    const { account, accountingEntityId } = payload;
    openingBalanceValidation.validatePostingAccount(account);

    const hasOpeningJournal =
      await deps.journalEntryRepo.existsOpeningBalanceByAccountId(
        account.id,
        accountingEntityId,
        repoOptions
      );
    if (hasOpeningJournal) {
      throw new journalEntryError.ExistingOpeningBalance({
        accountId: account.id,
      });
    }

    return makeOpeningBalance(deps, payload, null, repoOptions);
  };
}

/** Updates a draft in place, preserving its line identities and account. */
function makeUpdateDraft(
  deps: IDependencies
): IOpeningBalanceEntryService['updateDraft'] {
  return async (payload, repoOptions) => {
    const {
      entry,
      createdBy,
      account: preparedAccount,
      amount,
      exchangeRate,
      memo,
      attachments,
    } = payload;
    const effectiveDate = payload.effectiveDate ?? entry.effectiveDate;
    openingBalanceRevisionValidation.validateSourceType(entry);
    openingBalanceRevisionValidation.validateStatus(entry);

    const changes = { id: entry.id, effectiveDate, memo, attachments };
    const hasLineEdits =
      preparedAccount !== undefined ||
      amount !== undefined ||
      exchangeRate !== undefined;
    if (!hasLineEdits) {
      return journalEntryEntity.update(entry, changes, createdBy);
    }

    const openingLine = entry.lines.find((line) => line.sequenceOrder === 1);
    if (!openingLine) {
      throw new journalEntryError.MismatchedJournalLines({
        journalEntryId: entry.id,
      });
    }

    const account =
      preparedAccount ??
      (await deps.ledgerAccountRepo.findById(
        openingLine.accountId,
        entry.accountingEntityId,
        repoOptions
      ));
    if (!account) {
      throw new journalEntryError.AccountNotFound({
        accountId: openingLine.accountId,
      });
    }
    openingBalanceRevisionValidation.validateOpeningAccount(entry, account);
    openingBalanceValidation.validatePostingAccount(account);

    const [revised] = await makeOpeningBalance(
      deps,
      {
        account,
        accountingEntityId: entry.accountingEntityId,
        functionalCurrencyCode: openingLine.functionalAmount.currency.code,
        amount: amount ?? openingLine.amount,
        effectiveDate,
        exchangeRate:
          exchangeRate === undefined ? openingLine.exchangeRate : exchangeRate,
        createdBy,
      },
      null,
      repoOptions
    );
    openingBalanceRevisionValidation.validateLineSequences(entry, revised);

    const lines = revised.lines.map((line) => {
      const originalLine = entry.lines.find(
        (candidate) => candidate.sequenceOrder === line.sequenceOrder
      )!;

      return Object.freeze({
        ...line,
        id: originalLine.id,
        description: originalLine.description,
      });
    });

    return journalEntryEntity.update(entry, { ...changes, lines }, createdBy);
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
    const { accountingEntityId, effectiveDate } = entry;

    openingBalanceRevisionValidation.validateSourceType(entry);
    openingBalanceRevisionValidation.validateStatus(entry);
    openingBalanceRevisionValidation.validateAccountAssociation(entry, account);
    openingBalanceValidation.validateOpeningDateMatch(account, effectiveDate);

    const counterpartIds = [
      ...new Set(
        entry.lines
          .filter((line) => line.accountId !== account.id)
          .map((line) => line.accountId)
      ),
    ];
    const counterparts = await deps.ledgerAccountRepo.findAllByIds(
      counterpartIds,
      accountingEntityId,
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
        accountingEntityId,
        effectiveDate,
        postedAt: postingDate,
      },
      journalLines
    );

    dateUtils.validateDate(
      effectiveDate,
      journalEntryError.InvalidEffectiveDate
    );

    const hasEarlierPosting =
      await deps.journalEntryRepo.existsPostedByAccountId(
        account.id,
        accountingEntityId,
        repoOptions,
        effectiveDate
      );
    if (hasEarlierPosting) {
      throw new ledgerAccountError.OpeningBalanceLocked({
        accountId: account.id,
      });
    }

    const periodReadOptions = repoOptions.tx
      ? { ...repoOptions, lock: ERepoLock.Share }
      : repoOptions;
    await deps.accountingPeriodService.validatePostingPeriod(
      accountingEntityId,
      effectiveDate,
      periodReadOptions
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

/** Voids an opening journal and creates its reversal and replacement. */
function makeVoidAndReplace(
  deps: IDependencies
): IOpeningBalanceEntryService['voidAndReplace'] {
  return async ({ entry, ...payload }, repoOptions) => {
    const { account } = payload;
    const { accountingEntityId, effectiveDate } = entry;
    openingBalanceRevisionValidation.validateSourceType(entry);
    openingBalanceRevisionValidation.validateOpeningAccount(entry, account);
    openingBalanceValidation.validatePostingAccount(account);
    openingBalanceValidation.validateOpeningDateMatch(account, effectiveDate);

    dateUtils.validateDate(
      effectiveDate,
      journalEntryError.InvalidEffectiveDate
    );

    const voidReadOptions = repoOptions.tx
      ? { ...repoOptions, lock: ERepoLock.Share }
      : repoOptions;
    const correction = await deps.journalEntryService.void(
      entry,
      payload.createdBy,
      voidReadOptions
    );

    if (correction.reversal === null) {
      return { ...correction, replacement: null };
    }

    const hasEarlierPosting =
      await deps.journalEntryRepo.existsPostedByAccountId(
        account.id,
        accountingEntityId,
        repoOptions,
        effectiveDate
      );

    if (hasEarlierPosting) {
      throw new ledgerAccountError.OpeningBalanceLocked({
        accountId: account.id,
      });
    }

    const replacement = await makeOpeningBalance(
      deps,
      {
        ...payload,
        accountingEntityId,
        effectiveDate,
        functionalCurrencyCode: entry.lines[0].functionalAmount.currency.code,
        memo: entry.memo,
        attachments: entry.attachments,
      },
      new Date(),
      repoOptions
    );

    return { ...correction, replacement };
  };
}

export default function makeOpeningBalanceEntryService(
  deps: IDependencies
): IOpeningBalanceEntryService {
  const service: IOpeningBalanceEntryService = {
    create: makeCreate(deps),
    createDraft: makeCreateDraft(deps),
    updateDraft: makeUpdateDraft(deps),
    postDraft: makePostDraft(deps),
    voidAndReplace: makeVoidAndReplace(deps),
  };

  return Object.freeze(service);
}
