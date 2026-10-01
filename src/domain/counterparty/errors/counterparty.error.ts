import { TErrorCause, TErrorKey, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import DomainError from '@shared/values/errors/domain.error';

type TErrorPrefix = TErrorKey<'counterparty_error'>;

const EErrorKeys = {
  AlreadyActive: 'counterparty_error_already_active_conflict',
  Archived: 'counterparty_error_archived_conflict',
  InvalidUpdate: 'counterparty_error_update_invalid',
  InvalidVersion: 'counterparty_error_version_invalid',
  InvalidCreatedBy: 'counterparty_error_created_by_invalid',
  InvalidAccountingEntityId: 'counterparty_error_accounting_entity_id_invalid',
  InvalidCounterpartyId: 'counterparty_error_counterparty_id_invalid',
  InvalidName: 'counterparty_error_name_invalid',
  InvalidType: 'counterparty_error_type_invalid',
  InvalidStatus: 'counterparty_error_status_invalid',
  InvalidRole: 'counterparty_error_role_invalid',
  InvalidMeta: 'counterparty_error_meta_invalid',
  InvalidDate: 'counterparty_error_date_invalid',
  InvalidAddress: 'counterparty_error_address_invalid',
  RoleAlreadyAssigned: 'counterparty_error_role_already_assigned_conflict',
  InvalidCounterpartyPayload: 'counterparty_error_counterparty_payload_invalid',
  InvalidCounterpartyEntity: 'counterparty_error_counterparty_entity_invalid',
  InvalidCounterpartyAction: 'counterparty_error_counterparty_action_invalid',
} as const satisfies TErrorKeys<'counterparty_error'>;

type UCounterpartyError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class CounterpartyError<
  K extends TErrorPrefix = UCounterpartyError,
> extends DomainError<K> {
  constructor(key: K, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'CounterpartyError';
  }
}

const counterpartyError = Object.freeze({
  Base: CounterpartyError,
  ...errorUtils.getMappedErrors(EErrorKeys, CounterpartyError),
});

export default counterpartyError;
