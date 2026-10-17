import { RequestHandler } from 'express';

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IUserRepo from '@domain/user/repos/user.repo';
import IActorService from '@domain/user/types/actor.service.types';

import ITokenAppService from '@app/auth/contracts/token-service.contract';
import { IAppContextData } from '@app/context/types/app-context.types';

import getAccountingEntityFromRequest from '@interface/http/helpers/get-accounting-entity-from-request.helper';
import getAuthUserFromRequest from '@interface/http/helpers/get-auth-user-from-request.helper';

export default function makeAppContextEnrichmentMiddleware(
  appContext: IAppContextService<IAppContextData>,
  accountingEntityRepo: IAccountingEntityRepo,
  tokenAppService: ITokenAppService,
  userRepo: IUserRepo,
  actorService: IActorService
): RequestHandler {
  return async (req, _res, next) => {
    const { correlationId } = appContext.get();
    const repoOptions: IReadRepoOptions = { correlationId };

    const user = await getAuthUserFromRequest(
      req,
      tokenAppService,
      userRepo,
      repoOptions
    );

    const actor = user
      ? await actorService.resolveUser(user, repoOptions)
      : undefined;

    const accountingEntity = await getAccountingEntityFromRequest(
      req,
      accountingEntityRepo,
      repoOptions,
      user?.id
    );

    if (user || accountingEntity) {
      appContext.set({
        ...(user && { user, actor }),
        ...(accountingEntity && { accountingEntity }),
      });
    }

    next();
  };
}
