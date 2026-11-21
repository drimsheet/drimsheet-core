import { IWriteRepoOptions } from '@shared/types/repo.types';

import { IJurisdictionAccountingStandard } from '@domain/accounting/types/jurisdiction.types';

export default interface IJurisdictionAccountingStandardRepo {
  create(
    jurisdictionStandards:
      | IJurisdictionAccountingStandard
      | IJurisdictionAccountingStandard[],
    repoOptions: IWriteRepoOptions
  ): Promise<void>;
}
