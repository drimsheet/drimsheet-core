import { Request } from 'express';

import { IReadRepoOptions } from '@shared/types/repo.types';

import IUserRepo from '@domain/user/repos/user.repo';
import { IUser } from '@domain/user/types/user.types';

import ITokenAppService from '@app/auth/contracts/token-service.contract';

import getHttpHeaderValue from './get-http-header-value';

export default async function getAuthUserFromRequest(
  req: Request,
  tokenAppService: ITokenAppService,
  userRepo: IUserRepo,
  repoOptions: IReadRepoOptions
): Promise<IUser | null> {
  const bearerToken = getHttpHeaderValue('authorization', req.headers);

  if (!bearerToken) return null;

  const parts = bearerToken.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return null;
  }
  const token = parts[1];

  const authUser = await tokenAppService.getAuthUser(token);

  const user = await userRepo.findById(authUser.id, repoOptions);

  return user;
}
