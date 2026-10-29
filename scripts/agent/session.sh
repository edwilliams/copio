#!/usr/bin/env bash
# Launches agy for the autonomous ticket loop with a least-privilege GitHub token.
#
# - Uses a fine-grained PAT scoped to edwilliams/copio + edwilliams/copio-docs only
#   (no Workflows / Administration permission) instead of your personal gh login.
# - git over HTTPS picks it up via `gh auth git-credential`, which honours GH_TOKEN.
# - Prevents system sleep for the lifetime of the session.
#
# Setup: see "Security setup" in docs/tickets/autonomous-workflow.md.
set -euo pipefail

TOKEN_FILE="${COPIO_AGENT_TOKEN_FILE:-$HOME/.config/copio/agent-token}"

die() { echo "agent-session: $*" >&2; exit 1; }

[[ -r "$TOKEN_FILE" ]] || die "token file not found: $TOKEN_FILE"
perms="$(stat -c '%a' "$TOKEN_FILE")"
[[ "$perms" == "600" || "$perms" == "400" ]] || die "$TOKEN_FILE must be chmod 600 (is $perms)"

token="$(tr -d '[:space:]' < "$TOKEN_FILE")"
[[ "$token" == github_pat_* ]] || die "token must be a fine-grained PAT (github_pat_...), not a classic/OAuth token"

export GH_TOKEN="$token"
export GITHUB_TOKEN="$token"
unset token
# Make sure git never falls back to SSH keys (which have full account access).
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0='url.https://github.com/.insteadOf'
export GIT_CONFIG_VALUE_0='git@github.com:'
unset SSH_AUTH_SOCK

# Sanity check: token works and can see the repo.
gh api repos/edwilliams/copio --jq .full_name >/dev/null || die "token cannot access edwilliams/copio"

cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
exec systemd-inhibit --what=sleep:idle --why="agy autonomous agent loop" agy "$@"
