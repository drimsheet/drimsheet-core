import { TEntityId } from '@shared/types/uuid';

export interface IAuthTokenPayload {
  id: TEntityId;
}

export interface IPasswordResetTokenClaim extends IAuthTokenPayload {
  owner: string;
}

export default interface ITokenAppService {
  generateSignupToken(payload: IAuthTokenPayload): Promise<string>;
  verifySignupToken(token: string): Promise<IAuthTokenPayload>;
  claimSignupToken(token: string): Promise<IAuthTokenPayload>;
  finalizeSignupToken(id: string): Promise<void>;
  releaseSignupTokenClaim(id: string): Promise<void>;
  generateAccessToken(payload: IAuthTokenPayload): Promise<string>;
  generateRefreshToken(payload: IAuthTokenPayload): Promise<string>;
  verifyRefreshToken(token: string): IAuthTokenPayload;
  generatePasswordResetToken(payload: IAuthTokenPayload): Promise<string>;
  verifyPasswordResetToken(token: string): Promise<IAuthTokenPayload>;
  claimPasswordResetToken(token: string): Promise<IPasswordResetTokenClaim>;
  finalizePasswordResetToken(claim: IPasswordResetTokenClaim): Promise<void>;
  releasePasswordResetTokenClaim(
    claim: IPasswordResetTokenClaim
  ): Promise<void>;
  getAuthUser(token: string): Promise<IAuthTokenPayload>;
}
