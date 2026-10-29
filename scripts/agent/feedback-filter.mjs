/**
 * Pure filtering logic for the autonomous agent's PR feedback poller.
 *
 * Security model: the agent must only ever *see* feedback written by the
 * trusted reviewer. Everything else on a public PR (other users' comments,
 * bots, the agent's own replies) is dropped here, before it reaches the LLM.
 *
 * No Node/browser-specific imports so it can be unit tested in the browser
 * test runner and used from the Node CLI (`pr-feedback.mjs`).
 */

export const TRUSTED_LOGIN = 'edwilliams';

/** Prefix on every comment the agent posts. The agent shares the reviewer's
 * GitHub identity, so this is how its own replies are told apart from real feedback. */
export const AGENT_MARKER = '🤖 agent:';

/** Reaction the agent adds to a comment once it has been addressed. */
export const HANDLED_REACTION = 'rocket';

const REVIEW_ACK_RE = /addressed-review:(\d+)/g;

/**
 * @param {{ user?: { login?: string } }} item
 * @param {string} [trusted]
 */
export function isTrustedAuthor(item, trusted = TRUSTED_LOGIN) {
  return item?.user?.login === trusted;
}

/** @param {{ body?: string }} item */
export function isAgentPost(item) {
  return (item?.body ?? '').trimStart().startsWith(AGENT_MARKER);
}

/**
 * Review IDs the agent has already acknowledged via an `addressed-review:<id>`
 * tag inside one of its own (trusted + marked) issue comments.
 * @param {Array<{ user?: { login?: string }, body?: string }>} issueComments
 * @param {string} [trusted]
 * @returns {Set<number>}
 */
export function acknowledgedReviewIds(issueComments, trusted = TRUSTED_LOGIN) {
  const ids = new Set();
  for (const c of issueComments) {
    if (!isTrustedAuthor(c, trusted) || !isAgentPost(c)) continue;
    for (const m of (c.body ?? '').matchAll(REVIEW_ACK_RE)) ids.add(Number(m[1]));
  }
  return ids;
}

/**
 * Builds the list of unhandled feedback items from the trusted reviewer.
 *
 * @param {object} input
 * @param {any[]} input.issueComments   PR conversation comments (issues API)
 * @param {any[]} input.reviewComments  inline diff comments (pulls API)
 * @param {any[]} input.reviews         submitted reviews (pulls API)
 * @param {(kind: 'issue_comment' | 'review_comment', comment: any) => boolean} input.isHandled
 *   whether the trusted reviewer/agent has put the handled reaction on a comment
 * @param {string} [input.trusted]
 */
export function selectUnhandledFeedback({ issueComments, reviewComments, reviews, isHandled, trusted = TRUSTED_LOGIN }) {
  const fromReviewer = (c) => isTrustedAuthor(c, trusted) && !isAgentPost(c);
  const ackedReviews = acknowledgedReviewIds(issueComments, trusted);
  const items = [];

  for (const c of issueComments) {
    if (!fromReviewer(c) || isHandled('issue_comment', c)) continue;
    items.push({ ref: `issue_comment:${c.id}`, created_at: c.created_at, body: c.body, url: c.html_url });
  }

  for (const c of reviewComments) {
    if (!fromReviewer(c) || isHandled('review_comment', c)) continue;
    items.push({
      ref: `review_comment:${c.id}`,
      created_at: c.created_at,
      path: c.path,
      line: c.line ?? c.original_line ?? null,
      diff_hunk: c.diff_hunk,
      body: c.body,
      url: c.html_url,
    });
  }

  for (const r of reviews) {
    // Inline comments belonging to a review are reported individually above;
    // only the review summary body (or a changes-requested verdict) matters here.
    const hasBody = (r.body ?? '').trim() !== '';
    if (!fromReviewer(r) || ackedReviews.has(r.id)) continue;
    if (!hasBody && r.state !== 'CHANGES_REQUESTED') continue;
    items.push({ ref: `review:${r.id}`, created_at: r.submitted_at, state: r.state, body: r.body, url: r.html_url });
  }

  return items.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}
