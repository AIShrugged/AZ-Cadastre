import type {
  ProfileDto,
  ProfileSuggestionDto,
  SuggestProfileRequest,
} from '../dto/index.js';

export interface ProfilesApi {
  findMany(): Promise<ProfileDto[]>;

  /**
   * Which profile the figures declared at intake point at, and why.
   *
   * A recommendation the operator may ignore: nothing here narrows what
   * `POST /packages` accepts, and the profile a package is filed under is
   * always the one the operator sent. It answers with its reasoning because a
   * suggestion that cannot be argued with is one an operator can only obey or
   * distrust.
   *
   * Answers with no profile — and says why — where the declaration points at
   * none, where it points at more than one, and where nothing was declared at
   * all. It never falls back to the only profile there happens to be: an
   * office that ships one profile today and two tomorrow must not find that
   * the suggestion silently changed meaning.
   */
  suggest(request: SuggestProfileRequest): Promise<ProfileSuggestionDto>;
}
