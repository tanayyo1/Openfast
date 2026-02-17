# GitHub Branch Protection Setup Guide

This guide walks you through setting up branch protection rules to enforce our strict workflow.

---

## Why Branch Protection?

Branch protection ensures:

- No direct commits to main/develop
- All changes go through PR review
- Quality gates must pass before merge
- Linear issues are linked
- Security and compliance standards met

---

## Setup Steps

### Step 1: Access Branch Protection Settings

1. Go to GitHub repository: https://github.com/tanayyo1/ReditFast
2. Click **Settings** tab
3. In left sidebar, click **Branches**
4. Click **Add rule** button

---

### Step 2: Configure Rule for `main` Branch

**Branch name pattern:** `main`

#### Protect matching branches

Enable this checkbox.

#### Require a pull request before merging

**Required.** This prevents direct commits.

**Additional settings:**

- **Require approvals:** Set to `1` (minimum 1 reviewer)
- **Dismiss stale PR approvals when new commits are pushed**
- **Require review from CODEOWNERS** (optional, if you have CODEOWNERS file)

#### Require status checks to pass before merging

**Required.** This enforces our CI pipeline.

**Status checks that are required:**

```
validate-branch-name
lint-and-typecheck
unit-tests
integration-tests
security-scan
pr-validation
```

**Settings:**

- **Require branches to be up to date before merging**
- **Status checks:** Select all 6 checks listed above

### Temporary fallback: Local CI mode

If GitHub-hosted Actions cannot run (for example, billing is unavailable), temporarily disable required status checks and use local CI as the merge gate.

Required reference: `docs/LOCAL_CI.md`

Re-enable required status checks immediately after hosted CI is restored.

#### Require conversation resolution before merging

Ensures all review comments are addressed.

#### Require signed commits (optional but recommended)

Requires GPG signing for extra security.

#### Include administrators

**Required.** Rules apply to admins too (no exceptions).

#### Restrict who can push to matching branches

**Set to:** `Restrict pushes that create files larger than 100 MB`

#### Allow force pushes

**Set to:** Unchecked (Block force pushes)

#### Allow deletions

**Set to:** Unchecked (Block deletions)

---

### Step 3: Configure Rule for `develop` Branch

Create a second rule with pattern: `develop`

**Use same settings as main**, except:

**Status checks:**

```
validate-branch-name
lint-and-typecheck
unit-tests
security-scan
```

(Integration tests and full E2E are only required for main)

**Deployment:**

- You may allow auto-merge for develop after checks pass
- Main should always require manual merge

---

### Step 4: Advanced Settings (Optional)

#### Required Linear Issue in PR Title

Unfortunately, GitHub doesn't natively enforce PR title format. We handle this via:

1. **GitHub Actions** (already configured in `.github/workflows/ci.yml`)
   - The `pr-validation` job checks PR title format
   - Must match: `[LIN-XXX] Description`

2. **PR Template** (already configured)
   - Template enforces Linear issue linking
   - Reviewers should check this manually

#### CODEOWNERS File (Optional but Recommended)

Create `CODEOWNERS` file in repository root:

```
# Global owners
global-owner1@example.com global-owner2@example.com

# API changes require backend review
/src/app/api/ @backend-team

# Database changes require senior review
/prisma/ @senior-dev

# Infrastructure changes require DevOps
/.github/ @devops-team

# Documentation changes are more flexible
/docs/ @docs-team @anyone
```

Then enable "Require review from CODEOWNERS" in branch protection.

---

## Verification

### Test the Protection

1. **Try direct commit to main:**

   ```bash
   git checkout main
   git commit -m "test" --allow-empty
   git push origin main
   ```

   **Expected:** Push rejected

2. **Try push without PR:**

   ```bash
   git checkout -b test-branch
   git commit -m "test" --allow-empty
   git push origin test-branch
   # Try to merge without PR
   ```

   **Expected:** Cannot merge without PR

3. **Create proper PR:**
   ```bash
   git checkout -b feature/LIN-999-test
   git commit -m "LIN-999: Test protection" --allow-empty
   git push origin feature/LIN-999-test
   # Create PR on GitHub
   ```
   **Expected:** PR created, checks run, can merge after review

---

## Troubleshooting

### "Required status check not found"

**Problem:** Status check doesn't appear in list.

**Solution:**

1. The check must run at least once before it appears
2. Create a test PR to trigger CI
3. After first run, check will be available

### "Cannot merge, waiting for status"

**Problem:** Status checks stuck in "Expected".

**Solution:**

1. Check that CI workflow file is in `.github/workflows/`
2. Verify workflow triggers on PR
3. Check Actions tab for errors

### "Push rejected: protected branch"

**Problem:** Trying to push directly to main.

**Solution:**

```bash
# Create feature branch instead
git checkout -b feature/LIN-XXX-description
git commit -m "LIN-XXX: Description"
git push origin feature/LIN-XXX-description
# Create PR on GitHub
```

### Admins bypassing protection

**Problem:** Admin can push to main.

**Solution:**

1. Ensure "Include administrators" is checked
2. Remind team that rules apply to everyone
3. Enable signed commits for extra protection

---

## Team Communication

### Announce the New Rules

Send message to team (Slack/Discord/Email):

```
IMPORTANT: New Branch Protection Rules Active

Starting now, the following rules are enforced:

1. NO direct commits to main or develop
2. ALL changes must go through PR
3. ALL PRs need at least 1 review
4. ALL quality checks must pass
5. ALL PRs must link to Linear issue

Workflow:
1. Create branch: feature/LIN-XXX-description
2. Make changes, commit: "LIN-XXX: Description"
3. Push and create PR
4. Get review, address feedback
5. Merge when all checks pass

See CONTRIBUTING.md for full details.
Questions? Ask in #dev-questions
```

### Onboarding New Team Members

Add to onboarding checklist:

- [ ] Read CONTRIBUTING.md
- [ ] Read AGENTS.md
- [ ] Set up local environment
- [ ] Test git hooks work
- [ ] Create test PR to learn workflow
- [ ] Get first PR reviewed and merged

---

## Maintenance

### Regular Reviews

**Monthly:**

- Review branch protection rules
- Check if any checks need updating
- Verify CODEOWNERS assignments

**Quarterly:**

- Audit who has admin access
- Review merge history for bypasses
- Update rules based on team feedback

### Updating Rules

To modify rules:

1. Go to Settings → Branches
2. Click `main` rule
3. Make changes
4. Click "Save changes"
5. Announce changes to team

---

## Security Considerations

### Who Should Have Admin Access?

**Keep admin access minimal:**

- Allowed: Project owner (you)
- Allowed: 1-2 senior developers
- Not allowed: Not all developers
- Not allowed: Not external contractors (unless necessary)

**Admin responsibilities:**

- Can override protection in emergencies
- Must document reason for override
- Must notify team immediately
- Must revert override ASAP

### Emergency Overrides

**When to override (rare):**

- Critical security fix needed immediately
- Production down and fix is urgent
- CI system broken but code is good

**Process:**

1. Notify team in Slack #urgent
2. Override and push fix
3. Create PR after for review
4. Document in incident log
5. Re-enable protection immediately

---

## Alternative: GitHub Rulesets (New Feature)

GitHub recently introduced "Rulesets" which offer more flexibility.

### Migration to Rulesets (Optional)

**Advantages:**

- Multiple rules per branch
- Bypass lists with audit log
- More granular controls

**Setup:**

1. Settings → Rules → Rulesets
2. Create ruleset
3. Add rules similar to above
4. Enable bypass list with required reasons

**Recommendation:**

- Stick with classic branch protection for now
- Migrate to rulesets later if needed
- Document any migration in ADRs

---

## Quick Reference

**Settings Location:**

```
GitHub Repo → Settings → Branches → Add rule
```

**Required Checks:**

```
validate-branch-name
lint-and-typecheck
unit-tests
integration-tests (main only)
security-scan
pr-validation
```

**Required Reviews:**

```
Minimum: 1 human reviewer
CODEOWNERS: Optional
Dismiss stale: Yes
```

**Protection Summary:**

```
- Require PR
- Require 1 review
- Require status checks
- Up-to-date branches
- Include admins
- No force pushes
- No deletions
```

---

## Questions?

- **GitHub Docs:** https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- **Team Slack:** #dev-questions
- **Lead Developer:** [Your name/contact]

---

**Last Updated:** 2026-01-30
