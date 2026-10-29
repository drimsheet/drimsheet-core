import { relations } from 'drizzle-orm/relations';

import {
  accountingContextHistoryInAudit,
  accountingContextsInCore,
  accountingEntitiesInCore,
  accountingEntityHistoryInAudit,
  accountingIntervalHistoryInAudit,
  accountingIntervalsInCore,
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
  reportingIntervalHistoryInAudit,
  reportingIntervalsInCore,
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

export const actorsInCoreRelations = relations(
  actorsInCore,
  ({ one, many }) => ({
    actorsInCore_ownerActorId: one(actorsInCore, {
      fields: [actorsInCore.ownerActorId],
      references: [actorsInCore.id],
      relationName: 'actorsInCore_ownerActorId_actorsInCore_id',
    }),
    actorsInCores_ownerActorId: many(actorsInCore, {
      relationName: 'actorsInCore_ownerActorId_actorsInCore_id',
    }),
    actorsInCore_createdBy: one(actorsInCore, {
      fields: [actorsInCore.createdBy],
      references: [actorsInCore.id],
      relationName: 'actorsInCore_createdBy_actorsInCore_id',
    }),
    actorsInCores_createdBy: many(actorsInCore, {
      relationName: 'actorsInCore_createdBy_actorsInCore_id',
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
    userProfileHistoryInAudits_actorId: many(userProfileHistoryInAudit, {
      relationName: 'userProfileHistoryInAudit_actorId_actorsInCore_id',
    }),
    userProfileHistoryInAudits_onBehalfOf: many(userProfileHistoryInAudit, {
      relationName: 'userProfileHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    currenciesInCores: many(currenciesInCore),
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
    userPreferencesInCores: many(userPreferencesInCore),
    fiscalYearsInCores: many(fiscalYearsInCore),
    fiscalYearHistoryInAudits_actorId: many(fiscalYearHistoryInAudit, {
      relationName: 'fiscalYearHistoryInAudit_actorId_actorsInCore_id',
    }),
    fiscalYearHistoryInAudits_onBehalfOf: many(fiscalYearHistoryInAudit, {
      relationName: 'fiscalYearHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
    accountingIntervalsInCores: many(accountingIntervalsInCore),
    accountingPeriodsInCores: many(accountingPeriodsInCore),
    accountingIntervalHistoryInAudits_actorId: many(
      accountingIntervalHistoryInAudit,
      {
        relationName:
          'accountingIntervalHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    accountingIntervalHistoryInAudits_onBehalfOf: many(
      accountingIntervalHistoryInAudit,
      {
        relationName:
          'accountingIntervalHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
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
    reportingIntervalsInCores: many(reportingIntervalsInCore),
    reportingPeriodsInCores: many(reportingPeriodsInCore),
    reportingIntervalHistoryInAudits_actorId: many(
      reportingIntervalHistoryInAudit,
      {
        relationName: 'reportingIntervalHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    reportingIntervalHistoryInAudits_onBehalfOf: many(
      reportingIntervalHistoryInAudit,
      {
        relationName:
          'reportingIntervalHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
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
    journalEntriesInCores: many(journalEntriesInCore),
    journalEntryHistoryInAudits_actorId: many(journalEntryHistoryInAudit, {
      relationName: 'journalEntryHistoryInAudit_actorId_actorsInCore_id',
    }),
    journalEntryHistoryInAudits_onBehalfOf: many(journalEntryHistoryInAudit, {
      relationName: 'journalEntryHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
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
    subledgerFxCostBasisLotAcquisitionHistoryInAudits_actorId: many(
      subledgerFxCostBasisLotAcquisitionHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotAcquisitionHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotAcquisitionHistoryInAudits_onBehalfOf: many(
      subledgerFxCostBasisLotAcquisitionHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotAcquisitionHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores: many(
      subledgerFxCostBasisLotDispositionsInCore
    ),
    subledgerFxCostBasisLotDispositionHistoryInAudits_actorId: many(
      subledgerFxCostBasisLotDispositionHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionHistoryInAudit_actorId_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotDispositionHistoryInAudits_onBehalfOf: many(
      subledgerFxCostBasisLotDispositionHistoryInAudit,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionHistoryInAudit_onBehalfOf_actorsInCore_id',
      }
    ),
    subledgerFxCostBasisLotDispositionAllocationsInCores: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore
    ),
    bankDetailsInCores: many(bankDetailsInCore),
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

export const currenciesInCoreRelations = relations(
  currenciesInCore,
  ({ one, many }) => ({
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
    ledgerAccountBalanceAdjustmentsInCores_currencyCode: many(
      ledgerAccountBalanceAdjustmentsInCore,
      {
        relationName:
          'ledgerAccountBalanceAdjustmentsInCore_currencyCode_currenciesInCore_code',
      }
    ),
    ledgerAccountBalanceAdjustmentsInCores_functionalCurrencyCode: many(
      ledgerAccountBalanceAdjustmentsInCore,
      {
        relationName:
          'ledgerAccountBalanceAdjustmentsInCore_functionalCurrencyCode_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotsInCores_originalQuantityCurrency: many(
      subledgerFxCostBasisLotsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotsInCore_originalQuantityCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotsInCores_costBasisCurrency: many(
      subledgerFxCostBasisLotsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotsInCore_costBasisCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotAcquisitionsInCores_quantityCurrency: many(
      subledgerFxCostBasisLotAcquisitionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotAcquisitionsInCore_quantityCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotAcquisitionsInCores_costBasisCurrency: many(
      subledgerFxCostBasisLotAcquisitionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotAcquisitionsInCore_costBasisCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores_quantityCurrency: many(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionsInCore_quantityCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores_costBasisConsumedCurrency: many(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionsInCore_costBasisConsumedCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores_proceedsCurrency: many(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionsInCore_proceedsCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionsInCores_realizedGainLossCurrency: many(
      subledgerFxCostBasisLotDispositionsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionsInCore_realizedGainLossCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionAllocationsInCores_quantityCurrency: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionAllocationsInCore_quantityCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionAllocationsInCores_costBasisConsumedCurrency:
      many(subledgerFxCostBasisLotDispositionAllocationsInCore, {
        relationName:
          'subledgerFxCostBasisLotDispositionAllocationsInCore_costBasisConsumedCurrency_currenciesInCore_code',
      }),
    subledgerFxCostBasisLotDispositionAllocationsInCores_proceedsCurrency: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore,
      {
        relationName:
          'subledgerFxCostBasisLotDispositionAllocationsInCore_proceedsCurrency_currenciesInCore_code',
      }
    ),
    subledgerFxCostBasisLotDispositionAllocationsInCores_realizedGainLossCurrency:
      many(subledgerFxCostBasisLotDispositionAllocationsInCore, {
        relationName:
          'subledgerFxCostBasisLotDispositionAllocationsInCore_realizedGainLossCurrency_currenciesInCore_code',
      }),
  })
);

export const currencyExchangeRatesInCoreRelations = relations(
  currencyExchangeRatesInCore,
  ({ one }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [currencyExchangeRatesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    currenciesInCore_baseCurrencyCode: one(currenciesInCore, {
      fields: [currencyExchangeRatesInCore.baseCurrencyCode],
      references: [currenciesInCore.code],
      relationName:
        'currencyExchangeRatesInCore_baseCurrencyCode_currenciesInCore_code',
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
    usersInCore: one(usersInCore, {
      fields: [accountingEntitiesInCore.ownerId],
      references: [usersInCore.id],
    }),
    currenciesInCore: one(currenciesInCore, {
      fields: [accountingEntitiesInCore.functionalCurrencyCode],
      references: [currenciesInCore.code],
    }),
    jurisdictionsInCore: one(jurisdictionsInCore, {
      fields: [accountingEntitiesInCore.jurisdictionCode],
      references: [jurisdictionsInCore.code],
    }),
    userPreferencesInCores: many(userPreferencesInCore),
    fiscalYearsInCores: many(fiscalYearsInCore),
    accountingIntervalsInCores: many(accountingIntervalsInCore),
    accountingPeriodsInCores: many(accountingPeriodsInCore),
    accountingContextsInCores: many(accountingContextsInCore),
    reportingIntervalsInCores: many(reportingIntervalsInCore),
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

export const fiscalYearsInCoreRelations = relations(
  fiscalYearsInCore,
  ({ one, many }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [fiscalYearsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [fiscalYearsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    accountingIntervalsInCores: many(accountingIntervalsInCore),
    accountingContextsInCores: many(accountingContextsInCore),
    reportingIntervalsInCores: many(reportingIntervalsInCore),
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

export const accountingIntervalsInCoreRelations = relations(
  accountingIntervalsInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [accountingIntervalsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    fiscalYearsInCore: one(fiscalYearsInCore, {
      fields: [accountingIntervalsInCore.fiscalYearId],
      references: [fiscalYearsInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [accountingIntervalsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingPeriodsInCores: many(accountingPeriodsInCore),
    accountingContextsInCores: many(accountingContextsInCore),
  })
);

export const accountingPeriodsInCoreRelations = relations(
  accountingPeriodsInCore,
  ({ one }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [accountingPeriodsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [accountingPeriodsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    accountingIntervalsInCore: one(accountingIntervalsInCore, {
      fields: [accountingPeriodsInCore.intervalId],
      references: [accountingIntervalsInCore.id],
    }),
  })
);

export const accountingIntervalHistoryInAuditRelations = relations(
  accountingIntervalHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [accountingIntervalHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'accountingIntervalHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [accountingIntervalHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName:
        'accountingIntervalHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
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
    actorsInCore: one(actorsInCore, {
      fields: [accountingContextsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [accountingContextsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    accountingStandardsInCore: one(accountingStandardsInCore, {
      fields: [accountingContextsInCore.accountingStandardCode],
      references: [accountingStandardsInCore.code],
    }),
    fiscalYearsInCore: one(fiscalYearsInCore, {
      fields: [accountingContextsInCore.fiscalYearId],
      references: [fiscalYearsInCore.id],
    }),
    accountingIntervalsInCore: one(accountingIntervalsInCore, {
      fields: [accountingContextsInCore.accountingIntervalId],
      references: [accountingIntervalsInCore.id],
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

export const reportingIntervalsInCoreRelations = relations(
  reportingIntervalsInCore,
  ({ one, many }) => ({
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [reportingIntervalsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    fiscalYearsInCore: one(fiscalYearsInCore, {
      fields: [reportingIntervalsInCore.fiscalYearId],
      references: [fiscalYearsInCore.id],
    }),
    actorsInCore: one(actorsInCore, {
      fields: [reportingIntervalsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    reportingPeriodsInCores: many(reportingPeriodsInCore),
    reportingContextsInCores: many(reportingContextsInCore),
  })
);

export const reportingPeriodsInCoreRelations = relations(
  reportingPeriodsInCore,
  ({ one }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [reportingPeriodsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [reportingPeriodsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    reportingIntervalsInCore: one(reportingIntervalsInCore, {
      fields: [reportingPeriodsInCore.intervalId],
      references: [reportingIntervalsInCore.id],
    }),
  })
);

export const reportingIntervalHistoryInAuditRelations = relations(
  reportingIntervalHistoryInAudit,
  ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [reportingIntervalHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName: 'reportingIntervalHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [reportingIntervalHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName:
        'reportingIntervalHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
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
    actorsInCore: one(actorsInCore, {
      fields: [reportingContextsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [reportingContextsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    currenciesInCore: one(currenciesInCore, {
      fields: [reportingContextsInCore.reportingCurrencyCode],
      references: [currenciesInCore.code],
    }),
    accountingContextsInCore: one(accountingContextsInCore, {
      fields: [reportingContextsInCore.accountingContextId],
      references: [accountingContextsInCore.id],
    }),
    reportingIntervalsInCore: one(reportingIntervalsInCore, {
      fields: [reportingContextsInCore.reportingIntervalId],
      references: [reportingIntervalsInCore.id],
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
    actorsInCore: one(actorsInCore, {
      fields: [ledgerAccountsInCore.createdBy],
      references: [actorsInCore.id],
    }),
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
    actorsInCore: one(actorsInCore, {
      fields: [ledgerAccountBalancesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [ledgerAccountBalancesInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [ledgerAccountBalancesInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
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
  })
);

export const counterpartiesInCoreRelations = relations(
  counterpartiesInCore,
  ({ one, many }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [counterpartiesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [counterpartiesInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
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

export const journalEntriesInCoreRelations = relations(
  journalEntriesInCore,
  ({ one, many }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [journalEntriesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [journalEntriesInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
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
    actorsInCore: one(actorsInCore, {
      fields: [journalLinesInCore.createdBy],
      references: [actorsInCore.id],
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [journalLinesInCore.entryId],
      references: [journalEntriesInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [journalLinesInCore.accountId],
      references: [ledgerAccountsInCore.id],
    }),
    counterpartiesInCore: one(counterpartiesInCore, {
      fields: [journalLinesInCore.counterpartyId],
      references: [counterpartiesInCore.id],
    }),
    currenciesInCore_currencyCode: one(currenciesInCore, {
      fields: [journalLinesInCore.currencyCode],
      references: [currenciesInCore.code],
      relationName: 'journalLinesInCore_currencyCode_currenciesInCore_code',
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
    actorsInCore: one(actorsInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
    currenciesInCore_currencyCode: one(currenciesInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.currencyCode],
      references: [currenciesInCore.code],
      relationName:
        'ledgerAccountBalanceAdjustmentsInCore_currencyCode_currenciesInCore_code',
    }),
    currenciesInCore_functionalCurrencyCode: one(currenciesInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.functionalCurrencyCode],
      references: [currenciesInCore.code],
      relationName:
        'ledgerAccountBalanceAdjustmentsInCore_functionalCurrencyCode_currenciesInCore_code',
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [ledgerAccountBalanceAdjustmentsInCore.journalEntryId],
      references: [journalEntriesInCore.id],
    }),
  })
);

export const subledgerFxCostBasisLotsInCoreRelations = relations(
  subledgerFxCostBasisLotsInCore,
  ({ one, many }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [subledgerFxCostBasisLotsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [subledgerFxCostBasisLotsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    currenciesInCore_originalQuantityCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotsInCore.originalQuantityCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotsInCore_originalQuantityCurrency_currenciesInCore_code',
    }),
    currenciesInCore_costBasisCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotsInCore.costBasisCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotsInCore_costBasisCurrency_currenciesInCore_code',
    }),
    subledgerFxCostBasisLotAcquisitionsInCores: many(
      subledgerFxCostBasisLotAcquisitionsInCore
    ),
    subledgerFxCostBasisLotDispositionAllocationsInCores: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore
    ),
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
    actorsInCore: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    subledgerFxCostBasisLotsInCore: one(subledgerFxCostBasisLotsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.lotId],
      references: [subledgerFxCostBasisLotsInCore.id],
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.journalEntryId],
      references: [journalEntriesInCore.id],
    }),
    currenciesInCore_quantityCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.quantityCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotAcquisitionsInCore_quantityCurrency_currenciesInCore_code',
    }),
    currenciesInCore_costBasisCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionsInCore.costBasisCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotAcquisitionsInCore_costBasisCurrency_currenciesInCore_code',
    }),
  })
);

export const subledgerFxCostBasisLotAcquisitionHistoryInAuditRelations =
  relations(subledgerFxCostBasisLotAcquisitionHistoryInAudit, ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotAcquisitionHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotAcquisitionHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotAcquisitionHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  }));

export const subledgerFxCostBasisLotDispositionsInCoreRelations = relations(
  subledgerFxCostBasisLotDispositionsInCore,
  ({ one, many }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    journalEntriesInCore: one(journalEntriesInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.journalEntryId],
      references: [journalEntriesInCore.id],
    }),
    currenciesInCore_quantityCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.quantityCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionsInCore_quantityCurrency_currenciesInCore_code',
    }),
    currenciesInCore_costBasisConsumedCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionsInCore.costBasisConsumedCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionsInCore_costBasisConsumedCurrency_currenciesInCore_code',
    }),
    currenciesInCore_proceedsCurrency: one(currenciesInCore, {
      fields: [subledgerFxCostBasisLotDispositionsInCore.proceedsCurrency],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionsInCore_proceedsCurrency_currenciesInCore_code',
    }),
    currenciesInCore_realizedGainLossCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionsInCore.realizedGainLossCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionsInCore_realizedGainLossCurrency_currenciesInCore_code',
    }),
    subledgerFxCostBasisLotDispositionAllocationsInCores: many(
      subledgerFxCostBasisLotDispositionAllocationsInCore
    ),
  })
);

export const subledgerFxCostBasisLotDispositionHistoryInAuditRelations =
  relations(subledgerFxCostBasisLotDispositionHistoryInAudit, ({ one }) => ({
    actorsInCore_actorId: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotDispositionHistoryInAudit.actorId],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotDispositionHistoryInAudit_actorId_actorsInCore_id',
    }),
    actorsInCore_onBehalfOf: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotDispositionHistoryInAudit.onBehalfOf],
      references: [actorsInCore.id],
      relationName:
        'subledgerFxCostBasisLotDispositionHistoryInAudit_onBehalfOf_actorsInCore_id',
    }),
  }));

export const subledgerFxCostBasisLotDispositionAllocationsInCoreRelations =
  relations(subledgerFxCostBasisLotDispositionAllocationsInCore, ({ one }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [subledgerFxCostBasisLotDispositionAllocationsInCore.createdBy],
      references: [actorsInCore.id],
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
    subledgerFxCostBasisLotsInCore: one(subledgerFxCostBasisLotsInCore, {
      fields: [subledgerFxCostBasisLotDispositionAllocationsInCore.lotId],
      references: [subledgerFxCostBasisLotsInCore.id],
    }),
    currenciesInCore_quantityCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionAllocationsInCore.quantityCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionAllocationsInCore_quantityCurrency_currenciesInCore_code',
    }),
    currenciesInCore_costBasisConsumedCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionAllocationsInCore.costBasisConsumedCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionAllocationsInCore_costBasisConsumedCurrency_currenciesInCore_code',
    }),
    currenciesInCore_proceedsCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionAllocationsInCore.proceedsCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionAllocationsInCore_proceedsCurrency_currenciesInCore_code',
    }),
    currenciesInCore_realizedGainLossCurrency: one(currenciesInCore, {
      fields: [
        subledgerFxCostBasisLotDispositionAllocationsInCore.realizedGainLossCurrency,
      ],
      references: [currenciesInCore.code],
      relationName:
        'subledgerFxCostBasisLotDispositionAllocationsInCore_realizedGainLossCurrency_currenciesInCore_code',
    }),
  }));

export const jurisdictionAccountingStandardsInCoreRelations = relations(
  jurisdictionAccountingStandardsInCore,
  ({ one }) => ({
    jurisdictionsInCore: one(jurisdictionsInCore, {
      fields: [jurisdictionAccountingStandardsInCore.jurisdictionCode],
      references: [jurisdictionsInCore.code],
    }),
    accountingStandardsInCore: one(accountingStandardsInCore, {
      fields: [jurisdictionAccountingStandardsInCore.accountingStandardCode],
      references: [accountingStandardsInCore.code],
    }),
  })
);

export const bankDetailsInCoreRelations = relations(
  bankDetailsInCore,
  ({ one }) => ({
    actorsInCore: one(actorsInCore, {
      fields: [bankDetailsInCore.createdBy],
      references: [actorsInCore.id],
    }),
    accountingEntitiesInCore: one(accountingEntitiesInCore, {
      fields: [bankDetailsInCore.accountingEntityId],
      references: [accountingEntitiesInCore.id],
    }),
    ledgerAccountsInCore: one(ledgerAccountsInCore, {
      fields: [bankDetailsInCore.ledgerAccountId],
      references: [ledgerAccountsInCore.id],
    }),
  })
);
