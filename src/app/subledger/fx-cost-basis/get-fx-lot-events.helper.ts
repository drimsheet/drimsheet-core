import { IEvent } from '@shared/values/events/types/event.types';

import {
  IFxCostBasisAcquisitionResult,
  IFxCostBasisDispositionResult,
  IFxCostBasisReversalResult,
} from '@domain/subledger/fx-cost-basis/types/lot.service.types';

export default function getFxLotEventsHelper(
  effect:
    | IFxCostBasisAcquisitionResult
    | IFxCostBasisDispositionResult
    | IFxCostBasisReversalResult
    | null
): IEvent<unknown>[] {
  if (!effect) {
    return [];
  }

  if ('acquisition' in effect) {
    const [, lotEvents] = effect.lot;
    const [, acquisitionEvents] = effect.acquisition;
    return [...lotEvents, ...acquisitionEvents];
  }

  const lotEvents = effect.lots.flatMap(([, events]) => events);

  if ('disposition' in effect) {
    const [, dispositionEvents] = effect.disposition;
    return [...lotEvents, ...dispositionEvents];
  }

  return lotEvents;
}
