import {
  ICounterparty,
  ICreateCounterpartyPayload,
  IUpdateCounterpartyPayload,
  TAuditedCounterparty,
} from './counterparty.types';

export default interface ICounterpartyService {
  /** Prepares a validated update and optional activation without persistence. */
  update(
    counterparty: ICounterparty,
    payload: IUpdateCounterpartyPayload
  ): TAuditedCounterparty;

  create(payload: ICreateCounterpartyPayload): TAuditedCounterparty;
}
