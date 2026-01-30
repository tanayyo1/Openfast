## Linear Issue
<!-- Link to Linear issue - MANDATORY -->
Closes LIN-XXX (or Relates to LIN-XXX)

## Changes
<!-- Describe what changed and why -->
- Change 1: Description
- Change 2: Description
- Change 3: Description

## Type of Change
<!-- Mark relevant with [x] -->
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] ♻️ Code refactoring
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test updates

## Testing
<!-- Describe testing done -->
- [ ] Tested locally (describe steps)
- [ ] Unit tests pass: `npm run test:unit`
- [ ] Integration tests pass: `npm run test:integration`
- [ ] E2E tests pass (if applicable): `npm run test:e2e`
- [ ] Manual testing done

### Test Coverage
<!-- Include coverage report if applicable -->
```
Coverage: XX% (target: 80% for services, 70% for API routes)
```

## Screenshots / Videos
<!-- If UI changes, add screenshots or videos -->

## Security Considerations
<!-- Mark all that apply -->
- [ ] No secrets or PII logged
- [ ] Workspace isolation maintained in all DB queries
- [ ] Input validation added (Zod schemas)
- [ ] No hardcoded credentials
- [ ] Rate limiting considered
- [ ] Encryption used for sensitive data

## Documentation
<!-- Mark if docs updated -->
- [ ] AGENTS.md updated (if patterns changed)
- [ ] docs/API.md updated (if endpoints changed)
- [ ] docs/DECISIONS.md updated (if architectural decision)
- [ ] README.md updated (if user-facing changes)
- [ ] CHANGELOG.md updated
- [ ] Comments added to complex code

## Database Changes
<!-- If schema changed -->
- [ ] Migration file created: `npx prisma migrate dev --name descriptive_name`
- [ ] Migration tested locally
- [ ] No breaking changes (or documented)
- [ ] Rollback plan considered

## API Changes
<!-- If API modified -->
- [ ] Backward compatible
- [ ] New endpoints documented in docs/API.md
- [ ] Request/response examples provided
- [ ] Error handling documented

## Deployment Notes
<!-- Special deployment considerations -->
- [ ] Environment variables added (document in .env.example)
- [ ] Feature flags configured (if applicable)
- [ ] Database migration required
- [ ] Cache invalidation needed
- [ ] Third-party service configuration updated

## Pre-PR Checklist
<!-- All must be checked before requesting review -->
- [ ] Read AGENTS.md
- [ ] Branch named correctly: `feature/LIN-XXX-description`
- [ ] Commits follow format: `LIN-XXX: Description`
- [ ] `git pull origin main` done (no conflicts)
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] No `console.log` or `debugger` statements
- [ ] Code reviewed by yourself first
- [ ] PR size reasonable (<500 lines, or justified)

## Reviewer Notes
<!-- Things reviewers should pay attention to -->
- 

## Related PRs
<!-- Link to related PRs -->
- 

## Post-Merge Actions
<!-- Things to do after merge -->
- [ ] Deploy to staging
- [ ] Update Linear issue status
- [ ] Notify team in Slack
- [ ] Update documentation site (if applicable)
- [ ] Monitor error rates after deployment

## Screenshots of Changes
<!-- If applicable, add screenshots -->

---

**By submitting this PR, I confirm that:**
1. I have read and followed the guidelines in AGENTS.md
2. My changes follow the code style of this project
3. I have performed a self-review of my code
4. I have made corresponding changes to the documentation
5. My changes generate no new warnings
6. I have added tests that prove my fix is effective or my feature works
7. New and existing unit tests pass locally with my changes
8. Any dependent changes have been merged and published
