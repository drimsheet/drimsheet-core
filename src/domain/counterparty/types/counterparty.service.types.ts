import { IReadRepoOptions } from '@shared/types/repo.types';

import {
  ICounterparty,
  ICreateCounterpartyPayload,
  IUpdateCounterpartyPayload,
  TAuditedCounterparty,
} from './counterparty.types';

export default interface ICounterpartyService {
  /**
   * Prepares an audited update. The caller holds the counterparty FOR UPDATE lock
   * in options.tx through this read and persistence to prevent concurrent association.
   */
  update(
    counterparty: ICounterparty,
    payload: IUpdateCounterpartyPayload,
    options: IReadRepoOptions
  ): Promise<TAuditedCounterparty>;

  create(payload: ICreateCounterpartyPayload): TAuditedCounterparty;
}
