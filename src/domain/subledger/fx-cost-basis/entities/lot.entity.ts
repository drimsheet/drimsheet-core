import { TCreationOmits } from '@shared/types/creation-omits.types';
import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';
import { IEntityDelta } from '@shared/values/history/types/history.types';

import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import lotValidation from '@domain/subledger/fx-cost-basis/entities/validations/lot.validation';
import fxCostBasisLotError from '@domain/subledger/fx-cost-basis/errors/lot.error';
import FxCostBasisLotEvents from '@domain/subledger/fx-cost-basis/events/lot.events';
import {
  EFxCostBasisLotAuditAction,
  EFxCostBasisLotStatus,
  IFxCostBasisLot,
} from '@domain/subledger/fx-cost-basis/types/lot.types';
import fxCostBasisLotAudit from '@domain/subledger/fx-cost-basis/values/lot-audit.vo';

function make(
  payload: TCreationOmits<IFxCostBasisLot>
): TAuditedEntity<IFxCostBasisLot, IFxCostBasisLot, IFxCostBasisLot> {
  stringUtils.validateUUID(
    payload.ledgerAccountId,
    fxCostBasisLotError.InvalidLedgerAccountId
  );
  stringUtils.validateUUID(
    payload.accountingEntityId,
    fxCostBasisLotError.InvalidAccountingEntityId
  );
  lotValidation.validateStatus(payload.status);
  lotValidation.validateQuantity(
    payload.originalQuantity,
    payload.remainingQuantity
  );
  lotValidation.validateCostBasis(
    payload.costBasis,
    payload.remainingCostBasis
  );
  exchangeRateValue.validate(payload.acquisitionRate);
  dateUtils.validateDateIsNotInTheFuture(
    payload.acquisitionDate,
    fxCostBasisLotError.InvalidAcquisitionDate
  );

  stringUtils.validateUUID(
    payload.createdBy,
    fxCostBasisLotError.InvalidCreatedBy
  );

  const timestamp = new Date();

  const entity: IFxCostBasisLot = Object.freeze({
    id: generateUUID(),
    createdBy: payload.createdBy,
    ledgerAccountId: payload.ledgerAccountId,
    accountingEntityId: payload.accountingEntityId,
    status: payload.status,
    originalQuantity: payload.originalQuantity,
    remainingQuantity: payload.remainingQuantity,
    costBasis: payload.costBasis,
    remainingCostBasis: payload.remainingCostBasis,
    acquisitionRate: payload.acquisitionRate,
    acquisitionDate: payload.acquisitionDate,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const event = FxCostBasisLotEvents.created(entity);

  const audit = fxCostBasisLotAudit.make({
    before: null,
    after: entity,
    action: EFxCostBasisLotAuditAction.Created,
  });

  return [entity, [event], audit];
}

function consume(
  lot: IFxCostBasisLot,
  quantity: IFxCostBasisLot['remainingQuantity'],
  costBasis: IFxCostBasisLot['remainingCostBasis']
): TAuditedEntity<IFxCostBasisLot, IFxCostBasisLot, IFxCostBasisLot> {
  lotValidation.validateConsumption(lot, quantity, costBasis);

  const remainingQuantity = moneyValue.subtract(
    lot.remainingQuantity,
    quantity
  );
  const remainingCostBasis = moneyValue.subtract(
    lot.remainingCostBasis,
    costBasis
  );
  const isClosed = moneyValue.isZeroAmount(remainingQuantity);

  lotValidation.validateConsumptionRemainder(
    remainingQuantity,
    remainingCostBasis,
    costBasis
  );

  const timestamp = new Date();

  const status = isClosed
    ? EFxCostBasisLotStatus.Closed
    : EFxCostBasisLotStatus.Open;

  const entity: IFxCostBasisLot = Object.freeze({
    id: lot.id,
    createdBy: lot.createdBy,
    ledgerAccountId: lot.ledgerAccountId,
    accountingEntityId: lot.accountingEntityId,
    status,
    originalQuantity: lot.originalQuantity,
    remainingQuantity,
    costBasis: lot.costBasis,
    remainingCostBasis,
    acquisitionRate: lot.acquisitionRate,
    acquisitionDate: lot.acquisitionDate,
    version: lot.version + 1,
    createdAt: lot.createdAt,
    updatedAt: timestamp,
  });

  const event = FxCostBasisLotEvents.disposed(entity);

  const action = isClosed
    ? EFxCostBasisLotAuditAction.Closed
    : EFxCostBasisLotAuditAction.Disposed;

  const audit = fxCostBasisLotAudit.make({
    before: lot,
    after: entity,
    action,
  });

  return [entity, [event], audit];
}

function reverseAcquisition(
  lot: IFxCostBasisLot,
  quantity: IFxCostBasisLot['remainingQuantity'],
  costBasis: IFxCostBasisLot['remainingCostBasis']
): TAuditedEntity<IFxCostBasisLot, IFxCostBasisLot, IFxCostBasisLot> {
  lotValidation.validateConsumption(lot, quantity, costBasis);

  const remainingQuantity = moneyValue.subtract(
    lot.remainingQuantity,
    quantity
  );
  const remainingCostBasis = moneyValue.subtract(
    lot.remainingCostBasis,
    costBasis
  );
  const status = moneyValue.isZeroAmount(remainingQuantity)
    ? EFxCostBasisLotStatus.Closed
    : EFxCostBasisLotStatus.Open;
  const timestamp = new Date();
  const entity: IFxCostBasisLot = Object.freeze({
    id: lot.id,
    createdBy: lot.createdBy,
    ledgerAccountId: lot.ledgerAccountId,
    accountingEntityId: lot.accountingEntityId,
    status,
    originalQuantity: lot.originalQuantity,
    remainingQuantity,
    costBasis: lot.costBasis,
    remainingCostBasis,
    acquisitionRate: lot.acquisitionRate,
    acquisitionDate: lot.acquisitionDate,
    version: lot.version + 1,
    createdAt: lot.createdAt,
    updatedAt: timestamp,
  });
  const event = FxCostBasisLotEvents.reversed(entity);
  const audit = fxCostBasisLotAudit.make({
    before: lot,
    after: entity,
    action: EFxCostBasisLotAuditAction.Reversed,
  });

  return [entity, [event], audit];
}

function reverseDisposition(
  lot: IFxCostBasisLot,
  quantity: IFxCostBasisLot['remainingQuantity'],
  costBasis: IFxCostBasisLot['remainingCostBasis']
): [
  IFxCostBasisLot,
  IEvent<IFxCostBasisLot>[],
  IEntityDelta<IFxCostBasisLot> | null,
] {
  const remainingQuantity = moneyValue.add(lot.remainingQuantity, quantity);
  const remainingCostBasis = moneyValue.add(lot.remainingCostBasis, costBasis);

  lotValidation.validateQuantity(lot.originalQuantity, remainingQuantity);
  lotValidation.validateCostBasis(lot.costBasis, remainingCostBasis);

  const isUnchanged =
    lot.status === EFxCostBasisLotStatus.Open &&
    moneyValue.equals(lot.remainingQuantity, remainingQuantity) &&
    moneyValue.equals(lot.remainingCostBasis, remainingCostBasis);
  if (isUnchanged) {
    return [lot, [], null];
  }

  const timestamp = new Date();
  const entity: IFxCostBasisLot = Object.freeze({
    id: lot.id,
    createdBy: lot.createdBy,
    ledgerAccountId: lot.ledgerAccountId,
    accountingEntityId: lot.accountingEntityId,
    status: EFxCostBasisLotStatus.Open,
    originalQuantity: lot.originalQuantity,
    remainingQuantity,
    costBasis: lot.costBasis,
    remainingCostBasis,
    acquisitionRate: lot.acquisitionRate,
    acquisitionDate: lot.acquisitionDate,
    version: lot.version + 1,
    createdAt: lot.createdAt,
    updatedAt: timestamp,
  });
  const event = FxCostBasisLotEvents.reversed(entity);
  const audit = fxCostBasisLotAudit.make({
    before: lot,
    after: entity,
    action: EFxCostBasisLotAuditAction.Reversed,
  });

  return [entity, [event], audit];
}

const fxCostBasisLotEntity = Object.freeze({
  make,
  consume,
  reverseAcquisition,
  reverseDisposition,
  ...lotValidation,
});

export default fxCostBasisLotEntity;
