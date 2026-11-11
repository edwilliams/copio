# Project Guidelines & Rules

## Ticket Completion & PR Workflow
Whenever you complete a ticket:
1. Ensure the full CI verification suite passes locally (`npm run check:ci`).
2. Commit changes on a dedicated feature branch (`feature/<TICKET-ID>`).
3. If the `docs` submodule has changes, commit and push them to `origin master`.
4. Automatically push the feature branch to `origin` and open a Pull Request using `gh pr create`.
5. Verify both GitHub Actions checks and the Netlify Deploy Preview succeed before declaring complete:
   - Verify CI checks pass using `gh pr checks`.
   - Provide the user with the PR URL and the accompanying Netlify Deploy Preview URL:
     `https://deploy-preview-<PR_NUMBER>--copio.netlify.app`
   - Include simple, step-by-step instructions (in both the PR description and the completion response) on how to test the changes from a user's perspective, or explicitly note if user-facing UI testing isn't applicable (e.g. for research spikes, internal adapters, or CI/build-only changes) and how to verify it instead.

## `/goal` Execution Mode: Single Ticket (Default) vs. Continuous Loop
When invoked via `/goal`:
1. **Loop Trigger Check**:
   - Inspect whether the user's prompt explicitly requests a loop (e.g. contains `loop`, `--loop`, `-l`, `continuous`, or common typos like `lopp`).
2. **Single-Ticket Mode (Default — when no loop trigger is present)**:
   - Target: Resume active `feature/CPO-*` branch/PR if already open, or pick the next `todo` ticket from `docs/tickets/README.md` (or specific ticket if passed, e.g. `/goal CPO-015`).
   - Execute the **Ticket Completion & PR Workflow** above.
   - Once the PR is open and verified green (CI passed and Netlify Preview URL reported), declare completion with `<!-- GOAL_COMPLETE -->` and **STOP immediately**.
   - **DO NOT** enter a polling loop for PR merge and **DO NOT** pick subsequent tickets.
3. **Continuous Loop Mode (ONLY when loop trigger is present)**:
   - Perform the Single-Ticket workflow for the active or next ticket.
   - After opening the PR and verifying CI and the preview URL, do not stop.
   - Poll GitHub every 3 minutes for:
     - PR merge state: `gh pr view <PR_NUMBER> --json state --jq .state`
     - Review comments/feedback from `edwilliams`: `gh pr view <PR_NUMBER> --json comments,reviews` (and inline diff comments via `gh api repos/edwilliams/copio/pulls/<PR_NUMBER>/comments`).
   - Prefix agent PR replies with `🤖` so agent replies are distinct from `edwilliams` comments, and address any unaddressed feedback from `edwilliams`.
   - If new comments arrive: fix code, verify with `npm run check:ci`, commit & push, verify `gh pr checks`, and reply on the PR with `🤖`.
   - As soon as the PR state is `MERGED`, switch to master, `git pull origin master`, mark ticket `done` in `docs/tickets/README.md` and epic file (commit and push inside `docs/` to `origin master`), and automatically proceed to the next ticket.

