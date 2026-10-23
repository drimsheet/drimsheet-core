import {
  Body,
  Controller,
  Delete,
  Get,
  Middlewares,
  OperationId,
  Patch,
  Path,
  Post,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IAccountingInterval } from '@domain/accounting/types/accounting-period.types';
import {
  IAccountingContext,
  IReportingContext,
} from '@domain/accounting/types/context.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { IAccountingContextCreationReq } from '@app/accounting/dtos/accounting-context/accounting-context.dto';
import { IAccountingIntervalCreationReq } from '@app/accounting/dtos/accounting-interval/accounting-interval.dto';
import {
  IAccountingEntityCreationDto,
  IAccountingEntitySwitchReq,
  IAccountingEntityUpdateReq,
} from '@app/accounting/dtos/accounting/accounting.dto';
import { IFiscalYearCreationReq } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';
import { IReportingContextCreationReq } from '@app/accounting/dtos/reporting-context/reporting-context.dto';
import { IReportingIntervalCreationReq } from '@app/accounting/dtos/reporting-interval/reporting-interval.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  archiveAccountingEntityUseCase,
  createAccountingContextUseCase,
  createAccountingEntityUseCase,
  createAccountingIntervalUseCase,
  createFiscalYearUseCase,
  createReportingContextUseCase,
  createReportingIntervalUseCase,
  deleteAccountingEntityUseCase,
  getAccountingContextUseCase,
  getAccountingIntervalUseCase,
  getActiveAccountingEntityUseCase,
  getFiscalYearsUseCase,
  getFiscalYearUseCase,
  getJurisdictionsUseCase,
  getReportingContextUseCase,
  getUserAccountingEntitiesUseCase,
  switchAccountingEntityUseCase,
  updateAccountingEntityUseCase,
} from '@infra/ioc/usecases/accounting';

@Route('accounting')
@Tags('Accounting')
export class AccountingController extends Controller {
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

  /** Returns all fiscal years for x-accounting-entity-id. */
  @Get('/fiscal-years')
  @OperationId('getFiscalYears')
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
  public async getFiscalYears(): Promise<IFiscalYear[]> {
    return await getFiscalYearsUseCase();
  }

  /** Returns one fiscal year belonging to x-accounting-entity-id. */
  @Get('/fiscal-years/{id}')
  @OperationId('getFiscalYear')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getFiscalYear(@Path() id: string): Promise<IFiscalYear> {
    return await getFiscalYearUseCase(id);
  }

  /** Returns the fiscal year's context, including closed contexts, or null. */
  @Get('/fiscal-years/{id}/accounting-context')
  @OperationId('getAccountingContext')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getAccountingContext(
    @Path() id: string
  ): Promise<IAccountingContext | null> {
    this.setHeader('Content-Type', 'application/json');
    return await getAccountingContextUseCase(id);
  }

  /** Returns the fiscal year's accounting interval and its ordered periods. */
  @Get('/fiscal-years/{id}/accounting-interval')
  @OperationId('getAccountingInterval')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getAccountingInterval(
    @Path() id: string
  ): Promise<IAccountingInterval> {
    return await getAccountingIntervalUseCase(id);
  }

  /** Returns the fiscal year's context, including closed contexts, or null. */
  @Get('/fiscal-years/{id}/reporting-context')
  @OperationId('getReportingContext')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getReportingContext(
    @Path() id: string
  ): Promise<IReportingContext | null> {
    this.setHeader('Content-Type', 'application/json');
    return await getReportingContextUseCase(id);
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
  ): Promise<IAccountingEntity> {
    return await createAccountingEntityUseCase(body);
  }

  /** Creates only a fiscal year and its history for an existing entity owned by the caller. */
  @Post('/fiscal-year')
  @OperationId('createFiscalYear')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async createFiscalYear(
    @Body() body: IFiscalYearCreationReq
  ): Promise<IFiscalYear> {
    return await createFiscalYearUseCase(body);
  }

  /**
   * Creates an interval and its periods for x-accounting-entity-id.
   */
  @Post('/accounting-intervals')
  @OperationId('createAccountingInterval')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async createAccountingInterval(
    @Body() body: IAccountingIntervalCreationReq
  ) {
    return await createAccountingIntervalUseCase(body);
  }

  /**
   * Creates a context for x-accounting-entity-id from existing records;
   * archived entities return 409.Explicit period selection is required for current, historical,
   * and future years and never changes period status or posting eligibility.
   */
  @Post('/accounting-context')
  @OperationId('createAccountingContext')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async createAccountingContext(
    @Body() body: IAccountingContextCreationReq
  ) {
    return await createAccountingContextUseCase(body);
  }

  /**
   * Creates an interval and its periods for x-accounting-entity-id.
   */
  @Post('/reporting-intervals')
  @OperationId('createReportingInterval')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async createReportingInterval(
    @Body() body: IReportingIntervalCreationReq
  ) {
    return await createReportingIntervalUseCase(body);
  }

  /**
   * Creates only a reporting context and its history for x-accounting-entity-id;
   * archived entities return 409.
   * The selected reporting period must share the linked accounting context's entity and fiscal year.
   */
  @Post('/reporting-context')
  @OperationId('createReportingContext')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async createReportingContext(
    @Body() body: IReportingContextCreationReq
  ) {
    return await createReportingContextUseCase(body);
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
  ): Promise<IAccountingEntity> {
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
