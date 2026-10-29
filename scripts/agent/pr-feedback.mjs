#!/usr/bin/env node
/**
 * PR feedback helper for the autonomous agent loop (see docs/tickets/autonomous-workflow.md).
 *
 * Usage:
 *   node scripts/agent/pr-feedback.mjs status <PR>
 *     -> JSON: { pr, state, feedback: [...] } where feedback only contains
 *        unhandled comments/reviews written by the trusted reviewer.
 *
 *   node scripts/agent/pr-feedback.mjs reply <PR> <ref> <message>
 *     -> Posts a reply (auto-prefixed with the agent marker) and marks <ref> handled.
 *        <ref> is the `ref` field from `status`, e.g. issue_comment:123,
 *        review_comment:456 or review:789.
 *
 * All GitHub calls go through `gh` with argv arrays (no shell), so message
 * text can never be interpreted as a command.
 */
import { execFileSync } from 'node:child_process';
import { AGENT_MARKER, HANDLED_REACTION, TRUSTED_LOGIN, selectUnhandledFeedback } from './feedback-filter.mjs';

const REPO = 'edwilliams/copio';

function gh(args, { json = true } = {}) {
  const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return json ? JSON.parse(out) : out;
}

function getAll(path) {
  return gh(['api', '--paginate', '--slurp', path]).flat();
}

function post(path, fields) {
  const args = ['api', '-X', 'POST', path];
  for (const [k, v] of Object.entries(fields)) args.push('-f', `${k}=${v}`);
  return gh(args);
}

function reactionsPath(kind, id) {
  return kind === 'issue_comment'
    ? `repos/${REPO}/issues/comments/${id}/reactions`
    : `repos/${REPO}/pulls/comments/${id}/reactions`;
}

function isHandled(kind, comment) {
  if (!(comment.reactions?.[HANDLED_REACTION] > 0)) return false;
  // Only a reaction from the trusted account counts (anyone else reacting must not hide feedback).
  const reactions = getAll(`${reactionsPath(kind, comment.id)}?content=${HANDLED_REACTION}`);
  return reactions.some((r) => r.user?.login === TRUSTED_LOGIN);
}

function parsePr(value) {
  if (!/^\d+$/.test(value ?? '')) fail('PR number must be a positive integer');
  return Number(value);
}

function parseRef(value) {
  const m = /^(issue_comment|review_comment|review):(\d+)$/.exec(value ?? '');
  if (!m) fail('ref must look like issue_comment:<id>, review_comment:<id> or review:<id>');
  return { kind: m[1], id: Number(m[2]) };
}

function fail(msg) {
  console.error(`pr-feedback: ${msg}`);
  process.exit(2);
}

function status(pr) {
  const { state } = gh(['pr', 'view', String(pr), '--repo', REPO, '--json', 'state']);
  const feedback = selectUnhandledFeedback({
    issueComments: getAll(`repos/${REPO}/issues/${pr}/comments`),
    reviewComments: getAll(`repos/${REPO}/pulls/${pr}/comments`),
    reviews: getAll(`repos/${REPO}/pulls/${pr}/reviews`),
    isHandled,
  });
  console.log(JSON.stringify({ pr, state, feedback }, null, 2));
}

function reply(pr, ref, message) {
  if (!message?.trim()) fail('message is required');
  const body = `${AGENT_MARKER} ${message.trim()}`;
  if (ref.kind === 'review_comment') {
    post(`repos/${REPO}/pulls/${pr}/comments/${ref.id}/replies`, { body });
    post(reactionsPath('review_comment', ref.id), { content: HANDLED_REACTION });
  } else if (ref.kind === 'issue_comment') {
    post(`repos/${REPO}/issues/${pr}/comments`, { body });
    post(reactionsPath('issue_comment', ref.id), { content: HANDLED_REACTION });
  } else {
    // Reviews can't carry reactions via REST, so the ack is a tag in the reply itself.
    post(`repos/${REPO}/issues/${pr}/comments`, { body: `${body}\n\n<sub>addressed-review:${ref.id}</sub>` });
  }
  console.log(`replied to ${ref.kind}:${ref.id} and marked handled`);
}

const [cmd, prArg, refArg, ...rest] = process.argv.slice(2);
if (cmd === 'status') status(parsePr(prArg));
else if (cmd === 'reply') reply(parsePr(prArg), parseRef(refArg), rest.join(' '));
else fail('usage: pr-feedback.mjs status <PR> | reply <PR> <ref> <message>');
