import ITokenAppService from '@app/auth/contracts/token-service.contract';

const mockTokenAppService: jest.Mocked<ITokenAppService> = {
  generateSignupToken: jest.fn(),
  verifySignupToken: jest.fn(),
  claimSignupToken: jest.fn(),
  finalizeSignupToken: jest.fn(),
  releaseSignupTokenClaim: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  verifyPasswordResetToken: jest.fn(),
  claimPasswordResetToken: jest.fn(),
  finalizePasswordResetToken: jest.fn(),
  releasePasswordResetTokenClaim: jest.fn(),
  getAuthUser: jest.fn(),
};

export default mockTokenAppService;
