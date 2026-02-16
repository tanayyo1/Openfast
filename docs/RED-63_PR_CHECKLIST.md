# RED-63 Post structure validator – PR checklist

Use this to verify acceptance criteria before merge.

## Acceptance criteria

- [ ] **Draft gets structure score before scheduling**
  - Content worker runs validator and stores `structureValidation` (grade, score, warnings, rewriteSuggestions) on draft.
  - PATCH draft with title/body change re-runs validator and updates `structureValidation`.
  - GET `/api/drafts/:id?includeStructure=1` returns full `structure` (grade, score, warnings, rewriteSuggestions, goodBadExamples).
  - POST `/api/scheduled-posts` response includes `structure: { grade, score, warnings, rewriteSuggestions }`.

- [ ] **Clear warnings if product mentioned too early**
  - Validator warns when product is in headline (error) and when product appears in first 30% of post (error).
  - Panel shows warnings with red label for errors; schedule response includes warnings.

- [ ] **Rewrite suggestions provided**
  - Validator returns `rewriteSuggestions`; worker and API return them; panel shows them with Copy buttons.
  - Schedule response includes `structure.rewriteSuggestions`.

- [ ] **Integration with RED-40 draft generation**
  - Content worker (`processContentGenerateJob`) runs `validatePostStructure` on primary variant and stores result on draft.
  - Same draft model field `structureValidation` used (no duplicated state).

- [ ] **Shows what good/bad structures look like**
  - `GOOD_BAD_STRUCTURE_EXAMPLES` in code; panel shows good/bad in “Structure guide”; `/docs/post-structure` page and `docs/POST_STRUCTURE_VALIDATOR.md` document examples.

## Verification steps

1. **Database:** `npx prisma migrate dev` (or `db:push`) – ensure `drafts.structure_validation` exists.
2. **Backend:** `npm run typecheck` and `npm run lint`.
3. **Tests:** `npm test` (unit: validator good/bad, worker stores structure; integration: GET includeStructure=1 shape, schedule response structure).
4. **UI:** Open a draft; confirm Post structure panel shows grade, score, warnings (red for errors), rewrite suggestions with Copy, and “View full doc” link to `/docs/post-structure`.
5. **API:** `GET /api/drafts/:id?includeStructure=1` returns `structure`; `POST /api/scheduled-posts` returns `structure` with grade, score, warnings, rewriteSuggestions.
