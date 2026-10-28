import actorHistoryRepo from './actor-history.repo.impl';
import actorRepo from './actor.repo.impl';
import userAuthRepo from './user-auth.repo.impl';
import userHistoryRepo from './user-history.repo.impl';
import userPreferencesRepo from './user-preferences.repo.impl';
import userSessionRepo from './user-session.repo.impl';
import userRepo from './user.repo.impl';
import waitListMemberRepo from './waitlist-member.repo.impl';

const userRepos = {
  waitListMember: waitListMemberRepo,
  actor: actorRepo,
  actorHistory: actorHistoryRepo,
  user: userRepo,
  userAuth: userAuthRepo,
  userHistory: userHistoryRepo,
  userPreferences: userPreferencesRepo,
  userSession: userSessionRepo,
};

export default userRepos;
