# Contributing

Default branch: **`develop`**. Do not add features directly on `main` or `develop`.

1. Branch from `develop`: `feature/<short-name>` (or `fix/`, `docs/` when that is all you are changing).
2. Keep the branch to one MVP slice. See [`docs/mvp-build-plan.md`](./docs/mvp-build-plan.md).
3. Open a pull request **into `develop`**.
4. CI on GitHub Actions must pass. Fill in the PR template.
5. After merge, delete the feature branch.

Releases: merge `develop` → `main` when a slice is ready to deploy.

Full rules: [`docs/git-workflow.md`](./docs/git-workflow.md).
