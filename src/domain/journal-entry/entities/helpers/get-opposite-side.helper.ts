import journalLineValidation from '@domain/journal-entry/entities/validations/journal-line.validation';
import {
  EJournalSide,
  UJournalSide,
} from '@domain/journal-entry/types/journal-line.types';

export default function getOppositeJournalSideHelper(
  side: UJournalSide
): UJournalSide {
  journalLineValidation.validateSide(side);
  return side === EJournalSide.Debit ? EJournalSide.Credit : EJournalSide.Debit;
}
