import {
  Body,
  Controller,
  Get,
  Middlewares,
  OperationId,
  Post,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import {
  IEmailLoginReq,
  IRequestPasswordResetReq,
  IResetPasswordReq,
  IUserSignupReq,
  IVerifyEmailReq,
} from '@app/auth/dtos/auth/auth.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  getPasswordResetLinkUseCase,
  loginWithEmailUseCase,
  logoutUseCase,
  refreshAccessTokenUseCase,
  resetPasswordUseCase,
  signupWithEmailUseCase,
  verifyEmailUseCase,
} from '@infra/ioc/usecases/auth';

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  /**
   * User signup with email and password
   */
  @Post('/signup-with-email')
  @OperationId('signupWithEmail')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('429')
  @Middlewares(...middlewares.signupRateLimiters)
  public async signupWithEmail(@Body() body: IUserSignupReq) {
    await signupWithEmailUseCase(body);
  }

  /**
   *
   * Verify user email
   */
  @Post('signup/complete')
  @OperationId('verifyEmail')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('429')
  @Middlewares(middlewares.authRateLimiters.verifyEmail)
  public async verifyEmail(@Body() payload: IVerifyEmailReq) {
    this.setHeader('Cache-Control', 'no-store');
    return await verifyEmailUseCase(payload.token);
  }

  /**
   * User login with email and password
   */
  @Post('/login-with-email')
  @OperationId('loginWithEmail')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('429')
  @Middlewares(middlewares.authRateLimiters.loginWithEmail)
  public async loginWithEmail(@Body() body: IEmailLoginReq) {
    this.setHeader('Cache-Control', 'no-store');
    return await loginWithEmailUseCase(body);
  }

  /**
   * Start the Google OAuth flow.
   * Redirects the user to Google for authentication.
   */
  @Get('google')
  @OperationId('loginWithGoogle')
  @SuccessResponse('302')
  @Response<IHttpErrorDto>('500')
  @Middlewares(middlewares.initiateLoginWithGoogle)
  public loginWithGoogle() {
    return;
  }

  /**
   * Google OAuth callback.
   * Exchanges the Google user profile for an auth token and redirects to the client.
   */
  @Get('google/callback')
  @OperationId('loginWithGoogleCallback')
  @SuccessResponse('302')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('500')
  @Middlewares(middlewares.completeLoginWithGoogle)
  public async loginWithGoogleCallback() {
    return;
  }

  /**
   * Refresh access token
   */
  @Post('refresh-access-token')
  @OperationId('refreshAccessToken')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('429')
  @Response<IHttpErrorDto>('500')
  @Middlewares(middlewares.authRateLimiters.refreshAccessToken)
  public async refreshAccessToken() {
    this.setHeader('Cache-Control', 'no-store');
    return await refreshAccessTokenUseCase();
  }

  /**
   * Logout user
   */
  @Post('logout')
  @OperationId('logout')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('500')
  public async logout() {
    this.setHeader('Cache-Control', 'no-store');
    return await logoutUseCase();
  }

  /**
   *
   * Get password reset link
   */
  @Post('/get-password-reset-link')
  @OperationId('getPasswordResetLink')
  @Middlewares(
    middlewares.authRateLimiters.getPasswordResetLink,
    middlewares.authRateLimiters.getPasswordResetLinkByIp
  )
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('429')
  public async getPasswordResetLink(@Body() payload: IRequestPasswordResetReq) {
    this.setHeader('Cache-Control', 'no-store');
    return await getPasswordResetLinkUseCase(payload.email);
  }

  /**
   *
   * Reset password
   */
  @Post('reset-password')
  @OperationId('resetPassword')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('429')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.authRateLimiters.resetPassword,
    middlewares.authRateLimiters.resetPasswordByIp
  )
  public async resetPassword(@Body() payload: IResetPasswordReq) {
    this.setHeader('Cache-Control', 'no-store');
    return await resetPasswordUseCase(payload);
  }
}
