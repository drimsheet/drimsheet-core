import { Router } from 'express';

import { healthHandlers } from '@infra/ioc/handlers/http';

const router = Router();

router.get('/health/live', healthHandlers.live);
router.get('/health/ready', healthHandlers.ready);

export default router;
