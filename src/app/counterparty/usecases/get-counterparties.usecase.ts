/**
 * SUMMARY
 * Lists counterparties within the selected accounting entity using the
 * requested role, type, status, ordering, and pagination options. Returns
 * counterparty details with pagination metadata; the result page may be empty.
 *
 * WHEN TO USE
 * Use to browse or select counterparties, or to filter the entity's
 * counterparty directory.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import ICounterpartyRepo, {
  IFindAllCounterpartiesOptions,
} from '@domain/counterparty/repos/counterparty.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import {
  ICounterpartyDto,
  IGetCounterpartiesQuery,
} from '@app/counterparty/dtos/counterparty/counterparty.dto';
import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import { getCounterpartiesQueryValidationSchema } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  counterpartyRepo: ICounterpartyRepo;
}

export default function makeGetCounterpartiesUsecase(deps: IDependencies) {
  return async (
    query: IGetCounterpartiesQuery
  ): Promise<IPaginatedResponse<ICounterpartyDto>> => {
    zodValidationRunner(getCounterpartiesQueryValidationSchema, query);
    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const offset = paginationValue.pageToOffset(query.page, query.limit);
    const repoOptions: IFindAllCounterpartiesOptions = {
      ...query,
      offset,
      correlationId,
    };

    const repoRes = await deps.counterpartyRepo.findAll(
      accountingEntity.id,
      repoOptions
    );

    return {
      data: repoRes.data.map(counterpartyDtoMapper.toDto),
      meta: repoRes.meta,
    };
  };
}
