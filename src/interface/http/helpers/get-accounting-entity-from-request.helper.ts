import { Request } from 'express';

import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import appError from '@shared/values/errors/app.error';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import getHttpHeaderValue from './get-http-header-value';

export default async function getAccountingEntityFromRequest(
  req: Request,
  repo: IAccountingEntityRepo,
  repoOptions: IReadRepoOptions,
  userId?: TEntityId
): Promise<IAccountingEntity | null> {
  if (!userId) {
    return null;
  }

  const id = getHttpHeaderValue('x-accounting-entity-id', req.headers);

  if (!id) {
    return null;
  }

  const isValidUUID = stringUtils.isUUID(id);

  if (!isValidUUID) {
    throw new appError.BadRequest();
  }

  const accountingEntity = await repo.findByIdAndUserId(
    id as TEntityId,
    userId,
    repoOptions
  );

  if (!accountingEntity) {
    return null;
  }

  return accountingEntity;
}
