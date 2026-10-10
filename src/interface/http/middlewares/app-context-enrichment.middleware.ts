import { RequestHandler } from 'express';

import { IReadRepoOptions } from '@shared/types/repo.types';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IUserRepo from '@domain/user/repos/user.repo';
import IActorService from '@domain/user/types/actor.service.types';

import ITokenAppService from '@app/auth/contracts/token-service.contract';
import IAppContext from '@app/context/contracts/app-context.contract';

import getAccountingEntityFromRequest from '@interface/http/helpers/get-accounting-entity-from-request.helper';
import getAuthUserFromRequest from '@interface/http/helpers/get-auth-user-from-request.helper';

export default function makeAppContextEnrichmentMiddleware(
  appContext: IAppContext,
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
