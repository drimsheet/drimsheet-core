import {
  Body,
  Controller,
  Get,
  Middlewares,
  OperationId,
  Patch,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import { IUserPreferencesUpdateDto } from '@app/user/dtos/user/user.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  getAuthUserProfileUseCase,
  getUserPreferencesUseCase,
  updateUserPreferencesUseCase,
} from '@infra/ioc/usecases/user';

@Route('users')
@Tags('User')
export class UserController extends Controller {
  /**
   * Get user preferences
   */
  @Get('/preferences')
  @OperationId('getUserPreferences')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('404')
  @Security('bearerAuth')
  @Middlewares(middlewares.isAuthenticatedUser)
  public async getUserPreferences() {
    return getUserPreferencesUseCase();
  }

  /**
   * Get authenticated user profile
   */
  @Get('/profile')
  @OperationId('getAuthUserProfile')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('401')
  @Security('bearerAuth')
  @Middlewares(middlewares.isAuthenticatedUser)
  public async getAuthUserProfile() {
    return getAuthUserProfileUseCase();
  }

  /**
   * Update user preferences
   */
  @Patch('/preferences')
  @OperationId('updateUserPreferences')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Security('bearerAuth')
  @Middlewares(middlewares.isAuthenticatedUser)
  public async updateUserPreferences(@Body() body: IUserPreferencesUpdateDto) {
    return updateUserPreferencesUseCase(body);
  }
}
