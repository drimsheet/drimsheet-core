import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import {
  TAuditedCounterparty,
  UCounterpartyStatus,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';

export interface ICounterpartyFindOrCreatePayload {
  id?: string;
  name: string;
  type?: UCounterpartyType;
}

export interface ICounterpartyFindOrCreateRes {
  new: boolean;
  data: TAuditedCounterparty;
}

export default interface ICounterpartyAppService {
  findOrCreate(
    payload: ICounterpartyFindOrCreatePayload,
    accountingEntityId: TEntityId,
    createdBy: TEntityId,
    newRecordStatus: UCounterpartyStatus,
    repoOptions: IReadRepoOptions
  ): Promise<ICounterpartyFindOrCreateRes>;

  findOrCreateMany(
    payload: ICounterpartyFindOrCreatePayload[],
    accountingEntityId: TEntityId,
    createdBy: TEntityId,
    newRecordStatus: UCounterpartyStatus,
    repoOptions: IReadRepoOptions
  ): Promise<Map<string, ICounterpartyFindOrCreateRes>>;

  getFoundOrCreated(
    input: ICounterpartyFindOrCreatePayload,
    map: Map<string, ICounterpartyFindOrCreateRes>
  ): ICounterpartyFindOrCreateRes | undefined;
}
