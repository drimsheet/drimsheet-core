import {
  Body,
  Controller,
  Get,
  Middlewares,
  OperationId,
  Patch,
  Post,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import {
  IUserPreferencesUpdateDto,
  IUserProfileUpdateDto,
} from '@app/user/dtos/user/user.dto';
import { IJoinWaitListDto } from '@app/user/dtos/waitlist-member/waitlist-member.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  getAuthUserProfileUseCase,
  getUserPreferencesUseCase,
  joinWaitListUseCase,
  updateAuthUserProfileUseCase,
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

  /** Join the waitlist for a feature. Repeated submissions succeed. */
  @Post('/waitlist')
  @OperationId('joinWaitList')
  @SuccessResponse('204')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  public async joinWaitList(@Body() body: IJoinWaitListDto): Promise<void> {
    await joinWaitListUseCase(body);
    this.setStatus(204);
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

  /** Update the authenticated user's first and/or last name. */
  @Patch('/profile')
  @OperationId('updateAuthUserProfile')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Security('bearerAuth')
  @Middlewares(middlewares.isAuthenticatedUser)
  public async updateAuthUserProfile(@Body() body: IUserProfileUpdateDto) {
    return updateAuthUserProfileUseCase(body);
  }
}
