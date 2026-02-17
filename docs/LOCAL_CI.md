# Local CI Mode (Temporary)

Use this mode only when GitHub-hosted Actions cannot run (for example: billing disabled).

## Required command set

Run all commands from repository root:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test -- tests/unit/lib/recommendationGenerate.test.ts tests/unit/api/projectRecommendSubredditsRoute.test.ts tests/unit/api/projectRecommendationSelectRoute.test.ts tests/unit/api/projectPainPointsRoute.test.ts tests/unit/api/roadmapsRoute.test.ts
```

## Merge gate in Local CI mode

1. All commands above must pass.
2. PR description must include a `## Local CI Evidence` section.
3. Include short output summary:
   - lint: pass/fail
   - typecheck: pass/fail
   - unit tests: pass/fail
   - focused regression suite: pass/fail
4. Never push directly to `main`.

## PR evidence template

```md
## Local CI Evidence
- npm run lint: PASS
- npm run typecheck: PASS
- npm run test:unit: PASS
- focused regression suite: PASS
```

## Exit criteria

When GitHub-hosted CI is restored:

1. Re-enable required status checks in branch protection.
2. Keep local CI runs as a pre-PR quality step.
