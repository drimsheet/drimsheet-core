import makeOutboxAppService from '@app/outbox/services/outbox.service';

import outboxRepo from '@infra/persistence/repos/outbox';

const outboxAppService = makeOutboxAppService({ outboxRepo });

export default outboxAppService;
