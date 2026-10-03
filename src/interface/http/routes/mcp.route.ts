import { Router } from 'express';

import { mcpRouteHandler } from '@infra/ioc/handlers/http';

const router = Router();

router.all('/mcp', mcpRouteHandler);

export default router;
