import {
  Body,
  Controller,
  Delete,
  Get,
  Middlewares,
  OperationId,
  Patch,
  Post,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import {
  IAccountingEntityCreationDto,
  IAccountingEntityDto,
  IAccountingEntityOnboardingDto,
  IAccountingEntitySwitchReq,
  IAccountingEntityUpdateReq,
} from '@app/accounting/dtos/accounting/accounting.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  archiveAccountingEntityUseCase,
  createAccountingEntityUseCase,
  deleteAccountingEntityUseCase,
  getAccountingContextsUseCase,
  getActiveAccountingEntityUseCase,
  getJurisdictionsUseCase,
  getReportingContextsUseCase,
  getUserAccountingEntitiesUseCase,
  onboardAccountingEntityUseCase,
  switchAccountingEntityUseCase,
  updateAccountingEntityUseCase,
} from '@infra/ioc/usecases/accounting';

@Route('accounting')
@Tags('Accounting')
export class AccountingController extends Controller {
  /** Returns all unclosed contexts for x-accounting-entity-id, with each fiscal year and its periods. */
  @Get('/accounting-contexts')
  @OperationId('getAccountingContexts')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getAccountingContexts() {
    return await getAccountingContextsUseCase();
  }

  /**
   * Get user accounting entities
   */
  @Get('/accounting-entities')
  @OperationId('getUserAccountingEntities')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async getUserAccountingEntities() {
    return await getUserAccountingEntitiesUseCase();
  }

  /**
   * Get active accounting entity
   */
  @Get('/accounting-entity')
  @OperationId('getActiveAccountingEntity')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async getActiveAccountingEntity() {
    return await getActiveAccountingEntityUseCase();
  }

  /**
   * Get jurisdictions
   */
  @Get('/jurisdictions')
  @OperationId('getJurisdictions')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('500')
  public async getJurisdictions() {
    return await getJurisdictionsUseCase();
  }

  /** Returns all unclosed reporting contexts for x-accounting-entity-id, with each fiscal year and its reporting periods. */
  @Get('/reporting-contexts')
  @OperationId('getReportingContexts')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getReportingContexts() {
    return await getReportingContextsUseCase();
  }

  /**
   * Create only an accounting entity. Calendar and context setup is separate.
   */
  @Post('/accounting-entity')
  @OperationId('createAccountingEntity')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async createAccountingEntity(
    @Body() body: IAccountingEntityCreationDto
  ): Promise<IAccountingEntityDto> {
    return await createAccountingEntityUseCase(body);
  }

  /** Creates an entity with its initial calendar and contexts for onboarding. */
  @Post('/accounting-entity/onboarding')
  @OperationId('onboardAccountingEntity')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async onboardAccountingEntity(
    @Body() body: IAccountingEntityOnboardingDto
  ): Promise<IAccountingEntityDto> {
    return await onboardAccountingEntityUseCase(body);
  }

  /** Updates the entity selected by x-accounting-entity-id. Currency changes require no journal entries. */
  @Patch('/accounting-entity')
  @OperationId('updateAccountingEntity')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async updateAccountingEntity(
    @Body() body: IAccountingEntityUpdateReq
  ): Promise<IAccountingEntityDto> {
    return await updateAccountingEntityUseCase(body);
  }

  /** Archives the selected entity, retaining all accounting records. */
  @Post('/accounting-entity/archive')
  @OperationId('archiveAccountingEntity')
  @SuccessResponse('204')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async archiveAccountingEntity(): Promise<void> {
    await archiveAccountingEntityUseCase();
    this.setStatus(204);
  }

  /**
   * Switch the current accounting entity
   */
  @Post('/accounting-entity/switch')
  @OperationId('switchAccountingEntity')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async switchAccountingEntity(
    @Body() body: IAccountingEntitySwitchReq
  ) {
    return await switchAccountingEntityUseCase(body);
  }

  /** Deletes the selected entity only when it has no journal entries; otherwise returns 409. */
  @Delete('/accounting-entity')
  @OperationId('deleteAccountingEntity')
  @SuccessResponse('204')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async deleteAccountingEntity(): Promise<void> {
    await deleteAccountingEntityUseCase();
    this.setStatus(204);
  }
}
