# Contributing to Copio

Thank you for your interest in contributing to **Copio**! We welcome bug reports, documentation improvements, architectural feedback, and pull requests.

---

## 📜 Contributor License Agreement (CLA)

### Why We Require a CLA
Copio (`@copio/sdk`) is distributed under a **dual-licensing model**:
1. **Open Source:** [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) for open-source applications and evaluation.
2. **Commercial:** [Commercial License](LICENSE-COMMERCIAL.md) for companies embedding Copio into proprietary, closed-source SaaS products.

To maintain this model, the project maintainer must own or hold irrevocable licensing rights to all contributions. This ensures:
- We can grant commercial licenses to proprietary adopters without tracking down past contributors years later.
- The project is protected from patent or copyright encumbrances during corporate adoption or due diligence.
- Open-source users are guaranteed that the community edition remains open under the AGPL-3.0.

### How to Sign the CLA
All external pull requests require an accepted CLA before they can be merged. The process is fully automated:

1. Open your Pull Request against the `master` branch.
2. The **CLA Assistant** GitHub Action will automatically run and check your GitHub username against the signed list.
3. If you haven't signed yet, the CLA check will fail and the bot will comment on your PR with signing instructions.
4. Simply leave a comment on the Pull Request with the exact text:
   ```
   I have read the CLA Document and I hereby sign the CLA
   ```
5. The bot will record your signature in the repository and the status check will immediately turn green (passed).

Read the full agreement in [CLA.md](CLA.md).

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: `v20.x` or later (LTS recommended)
- **npm**: `v10.x` or later
- **Modern Browser**: Chromium-based browser (Chrome/Edge/Brave) for Playwright test execution

### Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/edwilliams/copio.git
cd copio
npm install
```

### Running Checks Locally
Before submitting a pull request, run the full verification suite to ensure all tests, types, and size thresholds pass:
```bash
npm run check:ci
```

This command runs:
- `npm run lint`: Fast code linting via `oxlint`
- `npm run typecheck`: Type validation via JSDoc and `tsc --noEmit`
- `npm run build:sdk`: Bundle compilation, Custom Elements Manifest generation, and type definitions build
- `npm run check:size`: Bundle budget verification
- `npm run check:consumer`: TypeScript declaration consumption check
- `npm test`: Node and Web Test Runner tests (Playwright Chromium)

You can also run individual commands:
```bash
npm run lint         # Check linter warnings and errors
npm run typecheck    # Check TypeScript types
npm test             # Run unit and component integration tests
```

---

## 🌿 Branch & Pull Request Workflow

1. **Create a Dedicated Branch**:
   - For planned roadmap items: `feature/CPO-<TICKET-ID>` (e.g., `feature/CPO-068`)
   - For bug fixes: `fix/<short-description>`
2. **Make Changes**:
   - Keep pull requests focused and atomic.
   - Follow the existing code style and architecture principles.
   - Maintain documentation and add tests for new functionality.
3. **Verify Locally**:
   - Run `npm run check:ci` and ensure all checks pass.
4. **Submit a Pull Request**:
   - Open a PR against `master`.
   - CI will run GitHub Actions checks and generate an ephemeral **Netlify Deploy Preview** URL (e.g. `https://deploy-preview-<PR_NUMBER>--copio.netlify.app`).
   - Sign the CLA by commenting `I have read the CLA Document and I hereby sign the CLA` if prompted by the CLA Assistant.

---

## 🏛️ Architecture & Design Principles

When contributing code, keep the following core tenets in mind:

1. **100% Privacy & Offline-First**: No remote telemetry, analytics, or external cloud calls. Documents and metadata stay entirely on the user's device unless explicitly synced via peer-to-peer WebRTC.
2. **Zero Framework Overhead**: The embeddable SDK (`<copio-scanner>`) is built using standard Web Components ([Lit](https://lit.dev)) and does not force heavy framework runtimes onto consumers.
3. **Pluggable Ports & Adapters**: Heavy services (OCR, PDF compilation, storage, sync) use abstract port interfaces with zero-cost defaults and lazy-loaded adapters so bundle sizes remain tight.
4. **Type Safety via JSDoc**: We use JSDoc annotations to infer and build `.d.ts` declaration files without requiring a TypeScript compile step for source code.
