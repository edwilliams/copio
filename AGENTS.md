# Project Guidelines & Rules

## Ticket Completion & PR Workflow
Whenever you complete a ticket or ticket group:
1. Ensure all tests pass (`npm test`).
2. Commit changes on a dedicated feature branch (`feature/<TICKET-IDS>`).
3. If the `docs` submodule has changes, commit and push them to `origin master`.
4. Automatically push the feature branch to `origin` and open a Pull Request using `gh pr create`.
5. Provide the user with the PR URL and the accompanying Netlify Deploy Preview URL:
   `https://deploy-preview-<PR_NUMBER>--copio.netlify.app`
   Verify or wait briefly for the Netlify build/preview to be generated.
