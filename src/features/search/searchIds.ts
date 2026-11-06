// The ids the search surfaces hand focus between: the summary bar takes focus when a
// user search is accepted, the submit takes it back when a slow search is cancelled,
// the disclosure controls the folding form region, and the subject id field takes focus
// when the server rejects the id.

/** Id of the summary bar, which takes focus when a user search is accepted. */
export const SEARCH_BAR_ID = 'kcp-search-bar';

/** Id of the folding form region the disclosure controls. */
export const SEARCH_FORM_ID = 'kcp-search-form';

/** Id of the disclosure that opens and closes the form under the bar. */
export const SEARCH_DISCLOSURE_ID = 'kcp-search-disclosure';

/** Id of the search submit, which takes focus when a slow search is cancelled. */
export const SEARCH_SUBMIT_ID = 'kcp-search-submit';

/** Id of the subject id field, which takes focus when the server rejects the id. */
export const SEARCH_SUBJECT_ID_INPUT_ID = 'kcp-search-subject-id';
