import { auditSchema, coreSchema } from './schemas';

export const accountingEntityType = {
  name: 'accounting_entity_type',
  schema: coreSchema,
};

export const accountingEntitiesTable = {
  name: 'accounting_entities',
  schema: coreSchema,
};

export const accountingEntityHistoryTable = {
  name: 'accounting_entity_history',
  schema: auditSchema,
};

export const accountingEntityStatus = {
  name: 'accounting_entity_status',
  schema: coreSchema,
};
