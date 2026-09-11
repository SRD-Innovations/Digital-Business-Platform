# Git workflow

GitHub default branch: **`develop`**.

```text
main                 releases / production
  ▲
develop              integration (default)
  ▲
feature/<slice>      one MVP slice
docs/<topic>         documentation-only
fix/<issue>          bugfix
```

## Rules

1. **Never commit features on `main` or directly on `develop`.** Open a branch.
2. Branch from the latest `develop`.
3. Name branches by intent:
   - `feature/core-auth`
   - `feature/pos-checkout`
   - `feature/offline-sync`
   - `docs/...` / `fix/...`
4. One concern per branch. Do not mix POS checkout with billing in the same PR.
5. Pull requests target **`develop`**.
6. After merge, delete the remote branch.
7. Promote to production by merging `develop` → `main` when a slice is deployable.

## Why this shape

The MVP is a sequence of risky slices (especially offline sync). Feature branches keep `develop` integrable and keep reviews small. `main` stays the line we can deploy from Vercel and Railway.

## PR expectations

- Fill in `.github/pull_request_template.md`
- CI green (web typecheck/build, API tests)
- No secrets, no `.env`
- If the slice changes architecture or stack, update `docs/` in the same PR

Planned slice order: [`mvp-build-plan.md`](./mvp-build-plan.md).
