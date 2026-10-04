import { relations } from 'drizzle-orm/relations';

import {
  accountingContextHistoryInAudit,
  accountingContextsInCore,
  accountingEntitiesInCore,
  accountingEntityHistoryInAudit,
  accountingPeriodHistoryInAudit,
  accountingPeriodsInCore,
  accountingStandardsInCore,
  actorHistoryInAudit,
  actorsInCore,
  bankDetailsInCore,
  counterpartiesInCore,
  counterpartyHistoryInAudit,
  currenciesInCore,
  currencyExchangeRatesInCore,
  fiscalYearHistoryInAudit,
  fiscalYearsInCore,
  journalEntriesInCore,
  journalEntryAttachmentsInCore,
  journalEntryHistoryInAudit,
  journalLineHistoryInAudit,
  journalLinesInCore,
  jurisdictionAccountingStandardsInCore,
  jurisdictionsInCore,
  ledgerAccountBalanceAdjustmentsInCore,
  ledgerAccountBalancesInCore,
  ledgerAccountHistoryInAudit,
  ledgerAccountsInCore,
  reportingContextHistoryInAudit,
  reportingContextsInCore,
  reportingPeriodHistoryInAudit,
  reportingPeriodsInCore,
  subledgerFxCostBasisLotAcquisitionHistoryInAudit,
  subledgerFxCostBasisLotAcquisitionsInCore,
  subledgerFxCostBasisLotDispositionAllocationsInCore,
  subledgerFxCostBasisLotDispositionHistoryInAudit,
  subledgerFxCostBasisLotDispositionsInCore,
  subledgerFxCostBasisLotHistoryInAudit,
  subledgerFxCostBasisLotsInCore,
  userAuthInCore,
  userPreferencesInCore,
  userProfileHistoryInAudit,
  userSessionsInCore,
  usersInCore,
} from './schema';

export const subledgerFxCostBasisLotDispositionHistoryInAuditRelations =
  relations(subledgerFxCostBasisLotDispositionHistoryInAudit, ({ one }) => ({
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotDispositionHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotDispositionHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    actorsInCore_actorId: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotDispositionHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotDispositionHistoryInAudit_actorId_actorsInCore_id',
    }),
  }));

export const actorsInCoreRelations = relations(
  actorsInCore,
  ({ one, many }) => ({
    subledgerFxCostBasisLotDispositionHistoryInAudits_onBehalfOf: many(
      subledgerFxCostBasisLotDispositionHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotDispositionHistoryInAudits_actorId: many(
      subledgerFxCostBasisLotDispositionHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotDispositionAllocationsInCores: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore
    ),
    actorsInCore_createdBy: one(actorsInCore, {
      fields: [actorsInCore.createdBy],
      references: [actorsInCore.id],
      relationName: 'actorsInCore_createdBy_actorsInCore_id',
    }),
    actorsInCores_createdBy: many(actorsInCore, {
      relationName: 'actorsInCore_createdBy_actorsInCore_id',
    }),
    actorsInCore_ownerActorId: one(actorsInCore, {
      fields: [actorsInCore.ownerActorId],
      references: [actorsInCore.id],
      relationName: 'actorsInCore_ownerActorId_actorsInCore_id',
    }),
    actorsInCores_ownerActorId: many(actorsInCore, {
      relationName: 'actorsInCore_ownerActorId_actorsInCore_id',
    }),
    actorHistoryInAudits_actorEntityId: many(actorHistoryInAudit, {
      relationName: 'actorHistoryInAudit_actorEntityId_actorsInCore_id',
    }),
    actorHistoryInAudits_actorId: many(actorHistoryInAudit, {
      relationName: 'actorHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorHistoryInAudits_onBehalfOf: many(actorHistoryInAudit, {
      relationName: 'actorHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    usersInCores_actorId: many(usersInCore, {
      relationName: 'usersInCore_actorId_actorsInCore_id',
    }),
    usersInCores_createdBy: many(usersInCore, {
      relationName: 'usersInCore_createdBy_actorsInCore_id',
    }),
    userAuthInCores: many(userAuthInCore),
    userSessionsInCores: many(userSessionsInCore),
    currenciesInCores: many(currenciesInCore),
    userProfileHistoryInAudits_actorId: many(userProfileHistoryInAudit, {
      relationName: 'userProfileHistoryInAudit_actorId_actorsInCore_id',
    }),
    userProfileHistoryInAudits_onBehalfOf: many(userProfileHistoryInAudit, {
      relationName: 'userProfileHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    currencyExchangeRatesInCores: many(currencyExchangeRatesInCore),
    accountingStandardsInCores: many(accountingStandardsInCore),
    jurisdictionsInCores: many(jurisdictionsInCore),
    accountingEntitiesInCores: many(accountingEntitiesInCore),
    accountingEntityHistoryInAudits_actorId: many(
      accountingEntityHistoryInAudit,
      {
        relationName: 'accountingEntityHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    accountingEntityHistoryInAudits_onBehalfOf: many(
      accountingEntityHistoryInAudit,
      {
        relationName:
          'accountingEntityHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    fiscalYearsInCores: many(fiscalYearsInCore),
    userPreferencesInCores: many(userPreferencesInCore),
    fiscalYearHistoryInAudits_actorId: many(fiscalYearHistoryInAudit, {
      relationName: 'fiscalYearHistoryInAudit_actorId_actorsInCore_id',
    }),
    fiscalYearHistoryInAudits_onBehalfOf: many(fiscalYearHistoryInAudit, {
      relationName: 'fiscalYearHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    accountingPeriodsInCores: many(accountingPeriodsInCore),
    accountingPeriodHistoryInAudits_actorId: many(
      accountingPeriodHistoryInAudit,
      {
        relationName: 'accountingPeriodHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    accountingPeriodHistoryInAudits_onBehalfOf: many(
      accountingPeriodHistoryInAudit,
      {
        relationName:
          'accountingPeriodHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    accountingContextsInCores: many(accountingContextsInCore),
    accountingContextHistoryInAudits_actorId: many(
      accountingContextHistoryInAudit,
      {
        relationName: 'accountingContextHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    accountingContextHistoryInAudits_onBehalfOf: many(
      accountingContextHistoryInAudit,
      {
        relationName:
          'accountingContextHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    reportingPeriodsInCores: many(reportingPeriodsInCore),
    reportingPeriodHistoryInAudits_actorId: many(
      reportingPeriodHistoryInAudit,
      {
        relationName: 'reportingPeriodHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    reportingPeriodHistoryInAudits_onBehalfOf: many(
      reportingPeriodHistoryInAudit,
      {
        relationName:
          'reportingPeriodHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    reportingContextsInCores: many(reportingContextsInCore),
    reportingContextHistoryInAudits_actorId: many(
      reportingContextHistoryInAudit,
      {
        relationName: 'reportingContextHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    reportingContextHistoryInAudits_onBehalfOf: many(
      reportingContextHistoryInAudit,
      {
        relationName:
          'reportingContextHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    ledgerAccountsInCores: many(ledgerAccountsInCore),
    ledgerAccountHistoryInAudits_actorId: many(ledgerAccountHistoryInAudit, {
      relationName: 'ledgerAccountHistoryInAudit_actorId_actorsInCore_id',
    }),
    ledgerAccountHistoryInAudits_onBehalfOf: many(ledgerAccountHistoryInAudit, {
      relationName: 'ledgerAccountHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    ledgerAccountBalancesInCores: many(ledgerAccountBalancesInCore),
    counterpartiesInCores: many(counterpartiesInCore),
    counterpartyHistoryInAudits_actorId: many(counterpartyHistoryInAudit, {
      relationName: 'counterpartyHistoryInAudit_actorId_actorsInCore_id',
    }),
    counterpartyHistoryInAudits_onBehalfOf: many(counterpartyHistoryInAudit, {
      relationName: 'counterpartyHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    journalEntryHistoryInAudits_actorId: many(journalEntryHistoryInAudit, {
      relationName: 'journalEntryHistoryInAudit_actorId_actorsInCore_id',
    }),
    journalEntryHistoryInAudits_onBehalfOf: many(journalEntryHistoryInAudit, {
      relationName: 'journalEntryHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    journalEntriesInCores: many(journalEntriesInCore),
    journalLinesInCores: many(journalLinesInCore),
    journalLineHistoryInAudits_actorId: many(journalLineHistoryInAudit, {
      relationName: 'journalLineHistoryInAudit_actorId_actorsInCore_id',
    }),
    journalLineHistoryInAudits_onBehalfOf: many(journalLineHistoryInAudit, {
      relationName: 'journalLineHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    ledgerAccountBalanceAdjustmentsInCores: many(
      ledgerAccountBalanceAdjustmentsInCore
    ),
    subledgerFxCostBasisLotsInCores: many(subledgerFxCostBasisLotsInCore),
    subledgerFxCostBasisLotHistoryInAudits_actorId: many(
      subledgerFxCostBasisLotHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotHistoryInAudits_onBehalfOf: many(
      subledgerFxCostBasisLotHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotAcquisitionsInCores: many(
      subledgerFxCostBasisLotAcquisitionsInCore
    ),
    subledgerFxCostBasisLotAcquisitionHistoryInAudits_onBehalfOf: many(
      subledgerFxCostBasisLotAcquisitionHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotAcquisitionHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotAcquisitionHistoryInAudits_actorId: many(
      subledgerFxCostBasisLotAcquisitionHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotAcquisitionHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores: many(
      subledgerFxCostBasisLotDispositionsInCore
    ),
    bankDetailsInCores: many(bankDetailsInCore),
  })
);

export const subledgerFxCostBasisLotDispositionAllocationsInCoreRelations =
  relations(subledgerFxCostBasisLotDispositionAllocationsInCore, ({ one }) => ({
    currenciesInCore_costBasisConsumedCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionAllocationsInCore.costBasisConsumedCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionAllocationsInCore_costBasisConsumedCurrency_currenciesInCore_code',
    }),
    currenciesInCore_realizedGainLossCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionAllocationsInCore.realizedGainLossCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionAllocationsInCore_realizedGainLossCurrency_currenciesInCore_code',
    }),
    currenciesInCore_proceedsCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionAllocationsInCore.proceedsCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionAllocationsInCore_proceedsCurrency_currenciesInCore_code',
    }),
    currenciesInCore_quantityCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionAllocationsInCore.quantityCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionAllocationsInCore_quantityCurrency_currenciesInCore_code',
    }),
    subledgerFxCostBasisLotDispositionsInCore: one(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        fields: [
          subledgerFxCostBasisLotDispositionAllocationsInCore.dispositionId,
        ],
        references: [subledgerFxCostBasisLotDispositionsInCore.id],
      }
    ),
    actorsInCore: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotDispositionAllocationsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    subledgerFxCostBasisLotsInCore: one(subledgerFxCostBasisLotsInCore, {
      fields: [subledgerFxCostBasisLotDispositionAllocationsInCore.lotId],
      references: [subledgerFxCostBasisLotsInCore.id],
    }),
  }));

export const currenciesInCoreRelations = relations(
  currenciesInCore,
  ({ one, many }) => ({
    subledgerFxCostBasisLotDispositionAllocationsInCores_costBasisConsumedCurrency:
      many(subledgerFxCostBasisLotDispositionAllocationsInCore, {
        relationName:
          'subledgerFxCostBasisLotDispositionAllocationsInCore_costBasisConsumedCurrency_currenciesInCore_code',
      }),
    subledgerFxCostBasisLotDispositionAllocationsInCores_realizedGainLossCurrency:
      many(subledgerFxCostBasisLotDispositionAllocationsInCore, {
        relationName:
          'subledgerFxCostBasisLotDispositionAllocationsInCore_realizedGainLossCurrency_currenciesInCore_code',
      }),
    subledgerFxCostBasisLotDispositionAllocationsInCores_proceedsCurrency: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionAllocationsInCore_proceedsCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionAllocationsInCores_quantityCurrency: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionAllocationsInCore_quantityCurrency_currenciesInCore_code',
      }
    ),
    actorsInCore: one(actorsInCore, {
      fields: [currenciesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currencyExchangeRatesInCores_baseCurrencyCode: many(
      currencyExchangeRatesInCore,
      {
        relationName:
          'currencyExchangeRatesInCore_baseCurrencyCode_currenciesInCore_code',
      }
    ),
    currencyExchangeRatesInCores_targetCurrencyCode: many(
      currencyExchangeRatesInCore,
      {
        relationName:
          'currencyExchangeRatesInCore_targetCurrencyCode_currenciesInCore_code',
      }
    ),
    jurisdictionsInCores: many(jurisdictionsInCore),
    accountingEntitiesInCores: many(accountingEntitiesInCore),
    reportingContextsInCores: many(reportingContextsInCore),
    ledgerAccountsInCores: many(ledgerAccountsInCore),
    ledgerAccountBalancesInCores_currencyCode: many(
      ledgerAccountBalancesInCore,
      {
        relationName:
          'ledgerAccountBalancesInCore_currencyCode_currenciesInCore_code',
      }
    ),
    ledgerAccountBalancesInCores_functionalCurrencyCode: many(
      ledgerAccountBalancesInCore,
      {
        relationName:
          'ledgerAccountBalancesInCore_functionalCurrencyCode_currenciesInCore_code',
      }
    ),
    journalLinesInCores_currencyCode: many(journalLinesInCore, {
      relationName: 'journalLinesInCore_currencyCode_currenciesInCore_code',
    }),
    journalLinesInCores_functionalCurrencyCode: many(journalLinesInCore, {
      relationName:
        'journalLinesInCore_functionalCurrencyCode_currenciesInCore_code',
    }),
    ledgerAccountBalanceAdjustmentsInCores_functionalCurrencyCode: many(
      ledgerAccountBalanceAdjustmentsInCore,
      {
        relationName:
          'ledgerAccountBalanceAdjustmentsInCore_functionalCurrencyCode_currenciesInCore_code',
      }
    ),
    ledgerAccountBalanceAdjustmentsInCores_currencyCode: many(
      ledgerAccountBalanceAdjustmentsInCore,
      {
        relationName:
          'ledgerAccountBalanceAdjustmentsInCore_currencyCode_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotsInCores_costBasisCurrency: many(
      subledgerFxCostBasisLotsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotsInCore_costBasisCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotsInCores_originalQuantityCurrency: many(
      subledgerFxCostBasisLotsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotsInCore_originalQuantityCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotAcquisitionsInCores_costBasisCurrency: many(
      subledgerFxCostBasisLotAcquisitionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotAcquisitionsInCore_costBasisCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotAcquisitionsInCores_quantityCurrency: many(
      subledgerFxCostBasisLotAcquisitionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotAcquisitionsInCore_quantityCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores_costBasisConsumedCurrency: many(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionsInCore_costBasisConsumedCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores_realizedGainLossCurrency: many(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionsInCore_realizedGainLossCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores_proceedsCurrency: many(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionsInCore_proceedsCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores_quantityCurrency: many(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionsInCore_quantityCurrency_currenciesInCore_code',
      }
    ),
  })
);

export const subledgerFxCostBasisLotDispositionsInCoreRelations = relations(
  subledgerFxCostBasisLotDispositionsInCore,
  ({ one, many }) => ({
    subledgerFxCostBasisLotDispositionAllocationsInCores: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore
    ),
    currenciesInCore_costBasisConsumedCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionsInCore.costBasisConsumedCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionsInCore_costBasisConsumedCurrency_currenciesInCore_code',
    }),
    currenciesInCore_realizedGainLossCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionsInCore.realizedGainLossCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionsInCore_realizedGainLossCurrency_currenciesInCore_code',
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.journalEntryId],
      references: [journalEntriesInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
    currenciesInCore_proceedsCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.proceedsCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionsInCore_proceedsCurrency_currenciesInCore_code',
    }),
    currenciesInCore_quantityCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.quantityCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionsInCore_quantityCurrency_currenciesInCore_code',
    }),
  })
);

export const subledgerFxCostBasisLotsInCoreRelations = relations(
  subledgerFxCostBasisLotsInCore,
  ({ one, many }) => ({
    subledgerFxCostBasisLotDispositionAllocationsInCores: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore
    ),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [subledgerFxCostBasisLotsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    currenciesInCore_costBasisCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotsInCore.costBasisCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotsInCore_costBasisCurrency_currenciesInCore_code',
    }),
    actorsInCore: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [subledgerFxCostBasisLotsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
    currenciesInCore_originalQuantityCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotsInCore.originalQuantityCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotsInCore_originalQuantityCurrency_currenciesInCore_code',
    }),
    subledgerFxCostBasisLotAcquisitionsInCores: many(
      subledgerFxCostBasisLotAcquisitionsInCore
    ),
  })
);

export const actorHistoryInAuditRelations = relations(
  actorHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorEntityId: one(actorsInCore, {
      fields: [actorHistoryInAudit.actorEntityId],
      references: [actorsInCore.id],
      relationName: 'actorHistoryInAudit_actorEntityId_actorsInCore_id',
    }),
    actorsInCore_actorId: one(actorsInCore, {
      fields: [actorHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'actorHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [actorHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'actorHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const usersInCoreRelations = relations(usersInCore, ({ one, many }) => ({
  actorsInCore_actorId: one(actorsInCore, {
    fields: [usersInCore.actorId],
    references: [actorsInCore.id],
    relationName: 'usersInCore_actorId_actorsInCore_id',
  }),
  actorsInCore_createdBy: one(actorsInCore, {
    fields: [usersInCore.createdBy],
    references: [actorsInCore.id],
    relationName: 'usersInCore_createdBy_actorsInCore_id',
  }),
  userAuthInCores: many(userAuthInCore),
  userSessionsInCores: many(userSessionsInCore),
  accountingEntitiesInCores: many(accountingEntitiesInCore),
  userPreferencesInCores: many(userPreferencesInCore),
}));

export const userAuthInCoreRelations = relations(userAuthInCore, ({ one }) => ({
  actorsInCore: one(actorsInCore, {
    fields: [userAuthInCore.createdBy],
    references: [actorsInCore.id],
  }),
  usersInCore: one(usersInCore, {
    fields: [userAuthInCore.userId],
    references: [usersInCore.id],
  }),
}));

export const userSessionsInCoreRelations = relations(
  userSessionsInCore,
  ({ one }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [userSessionsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    usersInCore: one(usersInCore, {
      fields: [userSessionsInCore.userId],
      references: [usersInCore.id],
    }),
  })
);

export const userProfileHistoryInAuditRelations = relations(
  userProfileHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [userProfileHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'userProfileHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [userProfileHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'userProfileHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const currencyExchangeRatesInCoreRelations = relations(
  currencyExchangeRatesInCore,
  ({ one }) => ({
    currenciesInCore_baseCurrencyCode: one(currenciesInCore, {
      fields: [currencyExchangeRatesInCore.baseCurrencyCode],
      references: [currenciesInCore.code],
      relationName:
        'currencyExchangeRatesInCore_baseCurrencyCode_currenciesInCore_code',
    }),
    actorsInCore: one(actorsInCore, {
      fields: [currencyExchangeRatesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currenciesInCore_targetCurrencyCode: one(currenciesInCore, {
      fields: [currencyExchangeRatesInCore.targetCurrencyCode],
      references: [currenciesInCore.code],
      relationName:
        'currencyExchangeRatesInCore_targetCurrencyCode_currenciesInCore_code',
    }),
  })
);

export const accountingStandardsInCoreRelations = relations(
  accountingStandardsInCore,
  ({ one, many }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [accountingStandardsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingContextsInCores: many(accountingContextsInCore),
    reportingContextsInCores: many(reportingContextsInCore),
    jurisdictionAccountingStandardsInCores: many(
      jurisdictionAccountingStandardsInCore
    ),
  })
);

export const jurisdictionsInCoreRelations = relations(
  jurisdictionsInCore,
  ({ one, many }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [jurisdictionsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currenciesInCore: one(currenciesInCore, {
      fields: [jurisdictionsInCore.currencyCode],
      references: [currenciesInCore.code],
    }),
    accountingEntitiesInCores: many(accountingEntitiesInCore),
    jurisdictionAccountingStandardsInCores: many(
      jurisdictionAccountingStandardsInCore
    ),
  })
);

export const accountingEntitiesInCoreRelations = relations(
  accountingEntitiesInCore,
  ({ one, many }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [accountingEntitiesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currenciesInCore: one(currenciesInCore, {
      fields: [accountingEntitiesInCore.functionalCurrencyCode],
      references: [currenciesInCore.code],
    }),
    jurisdictionsInCore: one(jurisdictionsInCore, {
      fields: [accountingEntitiesInCore.jurisdictionCode],
      references: [jurisdictionsInCore.code],
    }),
    usersInCore: one(usersInCore, {
      fields: [accountingEntitiesInCore.ownerId],
      references: [usersInCore.id],
    }),
    fiscalYearsInCores: many(fiscalYearsInCore),
    userPreferencesInCores: many(userPreferencesInCore),
    accountingPeriodsInCores: many(accountingPeriodsInCore),
    accountingContextsInCores: many(accountingContextsInCore),
    reportingPeriodsInCores: many(reportingPeriodsInCore),
    reportingContextsInCores: many(reportingContextsInCore),
    ledgerAccountsInCores: many(ledgerAccountsInCore),
    ledgerAccountBalancesInCores: many(ledgerAccountBalancesInCore),
    counterpartiesInCores: many(counterpartiesInCore),
    journalEntriesInCores: many(journalEntriesInCore),
    subledgerFxCostBasisLotsInCores: many(subledgerFxCostBasisLotsInCore),
    subledgerFxCostBasisLotAcquisitionsInCores: many(
      subledgerFxCostBasisLotAcquisitionsInCore
    ),
    subledgerFxCostBasisLotDispositionsInCores: many(
      subledgerFxCostBasisLotDispositionsInCore
    ),
    bankDetailsInCores: many(bankDetailsInCore),
  })
);

export const accountingEntityHistoryInAuditRelations = relations(
  accountingEntityHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [accountingEntityHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'accountingEntityHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [accountingEntityHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'accountingEntityHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const fiscalYearsInCoreRelations = relations(
  fiscalYearsInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [fiscalYearsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [fiscalYearsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingPeriodsInCores: many(accountingPeriodsInCore),
    accountingContextsInCores: many(accountingContextsInCore),
    reportingPeriodsInCores: many(reportingPeriodsInCore),
  })
);

export const userPreferencesInCoreRelations = relations(
  userPreferencesInCore,
  ({ one }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [userPreferencesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    usersInCore: one(usersInCore, {
      fields: [userPreferencesInCore.id],
      references: [usersInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [userPreferencesInCore.lastActiveAccountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
  })
);

export const fiscalYearHistoryInAuditRelations = relations(
  fiscalYearHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [fiscalYearHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'fiscalYearHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [fiscalYearHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'fiscalYearHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const accountingPeriodsInCoreRelations = relations(
  accountingPeriodsInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [accountingPeriodsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [accountingPeriodsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    fiscalYearsInCore: one(fiscalYearsInCore, {
      fields: [accountingPeriodsInCore.fiscalYearId],
      references: [fiscalYearsInCore.id],
    }),
    accountingContextsInCores: many(accountingContextsInCore),
  })
);

export const accountingPeriodHistoryInAuditRelations = relations(
  accountingPeriodHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [accountingPeriodHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'accountingPeriodHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [accountingPeriodHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'accountingPeriodHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const accountingContextsInCoreRelations = relations(
  accountingContextsInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [accountingContextsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    accountingStandardsInCore: one(accountingStandardsInCore, {
      fields: [accountingContextsInCore.accountingStandardCode],
      references: [accountingStandardsInCore.code],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [accountingContextsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingPeriodsInCore: one(accountingPeriodsInCore, {
      fields: [accountingContextsInCore.currentOperatingPeriodId],
      references: [accountingPeriodsInCore.id],
    }),
    fiscalYearsInCore: one(fiscalYearsInCore, {
      fields: [accountingContextsInCore.fiscalYearId],
      references: [fiscalYearsInCore.id],
    }),
    reportingContextsInCores: many(reportingContextsInCore),
  })
);

export const accountingContextHistoryInAuditRelations = relations(
  accountingContextHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [accountingContextHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'accountingContextHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [accountingContextHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName:
        'accountingContextHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const reportingPeriodsInCoreRelations = relations(
  reportingPeriodsInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [reportingPeriodsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [reportingPeriodsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    fiscalYearsInCore: one(fiscalYearsInCore, {
      fields: [reportingPeriodsInCore.fiscalYearId],
      references: [fiscalYearsInCore.id],
    }),
    reportingContextsInCores: many(reportingContextsInCore),
  })
);

export const reportingPeriodHistoryInAuditRelations = relations(
  reportingPeriodHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [reportingPeriodHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'reportingPeriodHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [reportingPeriodHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'reportingPeriodHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const reportingContextsInCoreRelations = relations(
  reportingContextsInCore,
  ({ one }) => ({
    accountingContextsInCore: one(accountingContextsInCore, {
      fields: [reportingContextsInCore.accountingContextId],
      references: [accountingContextsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [reportingContextsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    accountingStandardsInCore: one(accountingStandardsInCore, {
      fields: [reportingContextsInCore.accountingStandardCode],
      references: [accountingStandardsInCore.code],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [reportingContextsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    reportingPeriodsInCore: one(reportingPeriodsInCore, {
      fields: [reportingContextsInCore.currentReportingPeriodId],
      references: [reportingPeriodsInCore.id],
    }),
    currenciesInCore: one(currenciesInCore, {
      fields: [reportingContextsInCore.reportingCurrencyCode],
      references: [currenciesInCore.code],
    }),
  })
);

export const reportingContextHistoryInAuditRelations = relations(
  reportingContextHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [reportingContextHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'reportingContextHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [reportingContextHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'reportingContextHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const ledgerAccountsInCoreRelations = relations(
  ledgerAccountsInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [ledgerAccountsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [ledgerAccountsInCore.controlAccountId],
      references: [ledgerAccountsInCore.id],
      relationName:
        'ledgerAccountsInCore_controlAccountId_ledgerAccountsInCore_id',
    }),
    ledgerAccountsInCores: many(ledgerAccountsInCore, {
      relationName:
        'ledgerAccountsInCore_controlAccountId_ledgerAccountsInCore_id',
    }),
    actorsInCore: one(actorsInCore, {
      fields: [ledgerAccountsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currenciesInCore: one(currenciesInCore, {
      fields: [ledgerAccountsInCore.currencyCode],
      references: [currenciesInCore.code],
    }),
    ledgerAccountBalancesInCores: many(ledgerAccountBalancesInCore),
    journalLinesInCores: many(journalLinesInCore),
    ledgerAccountBalanceAdjustmentsInCores: many(
      ledgerAccountBalanceAdjustmentsInCore
    ),
    subledgerFxCostBasisLotsInCores: many(subledgerFxCostBasisLotsInCore),
    subledgerFxCostBasisLotAcquisitionsInCores: many(
      subledgerFxCostBasisLotAcquisitionsInCore
    ),
    subledgerFxCostBasisLotDispositionsInCores: many(
      subledgerFxCostBasisLotDispositionsInCore
    ),
    bankDetailsInCores: many(bankDetailsInCore),
  })
);

export const ledgerAccountHistoryInAuditRelations = relations(
  ledgerAccountHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [ledgerAccountHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'ledgerAccountHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [ledgerAccountHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'ledgerAccountHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const ledgerAccountBalancesInCoreRelations = relations(
  ledgerAccountBalancesInCore,
  ({ one }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [ledgerAccountBalancesInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [ledgerAccountBalancesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currenciesInCore_currencyCode: one(currenciesInCore, {
      fields: [ledgerAccountBalancesInCore.currencyCode],
      references: [currenciesInCore.code],
      relationName:
        'ledgerAccountBalancesInCore_currencyCode_currenciesInCore_code',
    }),
    currenciesInCore_functionalCurrencyCode: one(currenciesInCore, {
      fields: [ledgerAccountBalancesInCore.functionalCurrencyCode],
      references: [currenciesInCore.code],
      relationName:
        'ledgerAccountBalancesInCore_functionalCurrencyCode_currenciesInCore_code',
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [ledgerAccountBalancesInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
  })
);

export const counterpartiesInCoreRelations = relations(
  counterpartiesInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [counterpartiesInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [counterpartiesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    journalLinesInCores: many(journalLinesInCore),
  })
);

export const counterpartyHistoryInAuditRelations = relations(
  counterpartyHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [counterpartyHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'counterpartyHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [counterpartyHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'counterpartyHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const journalEntryHistoryInAuditRelations = relations(
  journalEntryHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [journalEntryHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'journalEntryHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [journalEntryHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'journalEntryHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const journalEntriesInCoreRelations = relations(
  journalEntriesInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [journalEntriesInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [journalEntriesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [journalEntriesInCore.voidingEntryId],
      references: [journalEntriesInCore.id],
      relationName:
        'journalEntriesInCore_voidingEntryId_journalEntriesInCore_id',
    }),
    journalEntriesInCores: many(journalEntriesInCore, {
      relationName:
        'journalEntriesInCore_voidingEntryId_journalEntriesInCore_id',
    }),
    journalEntryAttachmentsInCores: many(journalEntryAttachmentsInCore),
    journalLinesInCores: many(journalLinesInCore),
    ledgerAccountBalanceAdjustmentsInCores: many(
      ledgerAccountBalanceAdjustmentsInCore
    ),
    subledgerFxCostBasisLotAcquisitionsInCores: many(
      subledgerFxCostBasisLotAcquisitionsInCore
    ),
    subledgerFxCostBasisLotDispositionsInCores: many(
      subledgerFxCostBasisLotDispositionsInCore
    ),
  })
);

export const journalEntryAttachmentsInCoreRelations = relations(
  journalEntryAttachmentsInCore,
  ({ one }) => ({
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [journalEntryAttachmentsInCore.journalEntryId],
      references: [journalEntriesInCore.id],
    }),
  })
);

export const journalLinesInCoreRelations = relations(
  journalLinesInCore,
  ({ one }) => ({
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [journalLinesInCore.accountId],
      references: [ledgerAccountsInCore.id],
    }),
    counterpartiesInCore: one(counterpartiesInCore, {
      fields: [journalLinesInCore.counterpartyId],
      references: [counterpartiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [journalLinesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currenciesInCore_currencyCode: one(currenciesInCore, {
      fields: [journalLinesInCore.currencyCode],
      references: [currenciesInCore.code],
      relationName: 'journalLinesInCore_currencyCode_currenciesInCore_code',
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [journalLinesInCore.entryId],
      references: [journalEntriesInCore.id],
    }),
    currenciesInCore_functionalCurrencyCode: one(currenciesInCore, {
      fields: [journalLinesInCore.functionalCurrencyCode],
      references: [currenciesInCore.code],
      relationName:
        'journalLinesInCore_functionalCurrencyCode_currenciesInCore_code',
    }),
  })
);

export const journalLineHistoryInAuditRelations = relations(
  journalLineHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [journalLineHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'journalLineHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [journalLineHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName: 'journalLineHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const ledgerAccountBalanceAdjustmentsInCoreRelations = relations(
  ledgerAccountBalanceAdjustmentsInCore,
  ({ one }) => ({
    currenciesInCore_functionalCurrencyCode: one(currenciesInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.functionalCurrencyCode],
      references: [currenciesInCore.code],
      relationName:
        'ledgerAccountBalanceAdjustmentsInCore_functionalCurrencyCode_currenciesInCore_code',
    }),
    actorsInCore: one(actorsInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currenciesInCore_currencyCode: one(currenciesInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.currencyCode],
      references: [currenciesInCore.code],
      relationName:
        'ledgerAccountBalanceAdjustmentsInCore_currencyCode_currenciesInCore_code',
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.journalEntryId],
      references: [journalEntriesInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
  })
);

export const subledgerFxCostBasisLotHistoryInAuditRelations = relations(
  subledgerFxCostBasisLotHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  })
);

export const subledgerFxCostBasisLotAcquisitionsInCoreRelations = relations(
  subledgerFxCostBasisLotAcquisitionsInCore,
  ({ one }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    currenciesInCore_costBasisCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.costBasisCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotAcquisitionsInCore_costBasisCurrency_currenciesInCore_code',
    }),
    actorsInCore: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.journalEntryId],
      references: [journalEntriesInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
    subledgerFxCostBasisLotsInCore: one(subledgerFxCostBasisLotsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.lotId],
      references: [subledgerFxCostBasisLotsInCore.id],
    }),
    currenciesInCore_quantityCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.quantityCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotAcquisitionsInCore_quantityCurrency_currenciesInCore_code',
    }),
  })
);

export const subledgerFxCostBasisLotAcquisitionHistoryInAuditRelations =
  relations(subledgerFxCostBasisLotAcquisitionHistoryInAudit, ({ one }) => ({
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotAcquisitionHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    actorsInCore_actorId: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotAcquisitionHistoryInAudit_actorId_actorsInCore_id',
    }),
  }));

export const jurisdictionAccountingStandardsInCoreRelations = relations(
  jurisdictionAccountingStandardsInCore,
  ({ one }) => ({
    accountingStandardsInCore: one(accountingStandardsInCore, {
      fields: [jurisdictionAccountingStandardsInCore.accountingStandardCode],
      references: [accountingStandardsInCore.code],
    }),
    jurisdictionsInCore: one(jurisdictionsInCore, {
      fields: [jurisdictionAccountingStandardsInCore.jurisdictionCode],
      references: [jurisdictionsInCore.code],
    }),
  })
);

export const bankDetailsInCoreRelations = relations(
  bankDetailsInCore,
  ({ one }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [bankDetailsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [bankDetailsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [bankDetailsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
  })
);
