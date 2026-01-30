# Linear Integration Setup Guide

This guide walks you through integrating Linear with GitHub for seamless issue tracking and branch management.

---

## Why Linear + GitHub Integration?

✅ **Automatic issue linking** - PRs linked to Linear issues
✅ **Status updates** - Linear status changes as PR moves
✅ **Branch naming** - Enforced via CI checks
✅ **Visibility** - See code changes in Linear
✅ **Traceability** - Every commit traces back to issue

---

## Setup Steps

### Step 1: Install Linear GitHub Integration

1. Go to Linear app: https://linear.app
2. Click your workspace name (top left)
3. Go to **Settings** → **Integrations**
4. Find **GitHub** in the list
5. Click **Install**
6. Select your repository: `tanayyo1/ReditFast`
7. Authorize access

---

### Step 2: Configure Integration Settings

**In Linear → Settings → Integrations → GitHub:**

#### ☑️ Link Pull Requests to Issues
Enable automatic linking when PR title contains issue ID.

#### ☑️ Update Issue Status on PR Events
Configure status mapping:

```
PR Opened → "In Review"
PR Approved → "Ready to Merge"
PR Merged → "Done"
PR Closed (not merged) → "Cancelled"
```

#### ☑️ Show PR Status in Linear
See PR checks and merge status directly in Linear.

#### ☑️ Create Branches from Linear
Enable "Create branch" button in Linear issues.

**Branch format template:**
```
{{type}}/{{identifier}}-{{title}}
# Results in: feature/LIN-123-add-scheduler
```

---

### Step 3: Configure GitHub Repository

**In GitHub → Repository Settings:**

#### Webhook Configuration (Auto-created by Linear)

The integration automatically creates a webhook:
- **Payload URL:** Linear's endpoint
- **Events:** Pull requests, Pushes, Comments

Verify webhook is active:
1. GitHub → Settings → Webhooks
2. Look for Linear webhook
3. Check "Recent Deliveries" for green checkmarks

#### Branch Protection Integration

Ensure these settings align:
- PR titles must include Linear issue ID
- CI checks validate Linear linking
- Merge requires Linear issue reference

---

### Step 4: Create Issue States in Linear

**Recommended workflow states:**

1. **Backlog** - Ideas and future work
2. **Todo** - Ready to start
3. **In Progress** - Actively working
4. **In Review** - PR opened, code review
5. **Ready to Merge** - Approved, waiting to merge
6. **Done** - Merged and deployed
7. **Cancelled** - Closed without merging

**Setup:**
1. Linear → Settings → Workflow
2. Add/edit states
3. Map to GitHub PR events (see Step 2)

---

### Step 5: Test the Integration

#### Test 1: Create Issue and Branch

1. Create Linear issue: "Add user dashboard"
   - Issue ID: `LIN-100`
   
2. Click "Create branch" in Linear
   - Suggested: `feature/LIN-100-add-user-dashboard`
   
3. Copy command:
   ```bash
   git checkout -b feature/LIN-100-add-user-dashboard
   ```

#### Test 2: Commit and Push

```bash
# Make changes
git add .
git commit -m "LIN-100: Add user dashboard component"
git push origin feature/LIN-100-add-user-dashboard
```

#### Test 3: Create Pull Request

1. Go to GitHub
2. Create PR from your branch
3. Title: `[LIN-100] Add user dashboard`
4. Fill out PR template
5. Add `Closes LIN-100` in description

**Expected in Linear:**
- Issue status changes to "In Review"
- PR link appears in issue
- PR status (checks) visible

#### Test 4: Merge and Verify

1. Get PR approved
2. Click "Merge"
3. Check Linear

**Expected in Linear:**
- Issue status changes to "Done"
- Merged indicator shown
- Git commit links added

---

## Advanced Configuration

### Automatic Issue Creation

**From GitHub Issues:**

Linear can sync GitHub Issues to Linear:

1. Linear → Settings → Integrations → GitHub
2. Enable "Sync GitHub Issues"
3. Choose mapping:
   - GitHub Issue → Linear Issue
   - GitHub Label → Linear Label
   - GitHub Milestone → Linear Cycle

### Label Sync

**Map labels between systems:**

```
GitHub: "bug" → Linear: "Bug"
GitHub: "feature" → Linear: "Feature"
GitHub: "urgent" → Linear: "Urgent"
```

Setup:
1. Linear → Settings → Integrations → GitHub → Labels
2. Add mappings

### Milestone → Cycle Sync

**GitHub milestones become Linear cycles:**

1. Create milestone in GitHub: "Sprint 1"
2. Linear automatically creates Cycle: "Sprint 1"
3. Issues assigned to milestone appear in cycle

---

## Team Workflow

### Daily Workflow

**Developer morning routine:**
1. Open Linear
2. Check "Todo" and "In Progress" issues
3. Pick next issue
4. Click "Create branch"
5. Start coding

**Developer end of day:**
1. Push changes
2. Create PR if ready
3. Update Linear issue with notes
4. Move to "In Review" if PR opened

### Issue Templates

**Create templates in Linear for consistency:**

**Bug Template:**
```
## Bug Description
<!-- What happened? -->

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
<!-- What should happen? -->

## Screenshots
<!-- If applicable -->

## Environment
- OS: 
- Browser: 
- Version: 
```

**Feature Template:**
```
## Feature Description
<!-- What should be built? -->

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
<!-- Implementation hints -->

## Design
<!-- Links to Figma/designs -->
```

Setup:
1. Linear → Settings → Templates
2. Create new template
3. Set as default for issue type

---

## Best Practices

### Issue Creation

**Good Linear Issue:**
- ✅ Clear, specific title
- ✅ Detailed description
- ✅ Acceptance criteria
- ✅ Assigned to person
- ✅ Due date set
- ✅ Labels applied
- ✅ Linked to project/roadmap

**Bad Linear Issue:**
- ❌ Vague title ("Fix stuff")
- ❌ No description
- ❌ No acceptance criteria
- ❌ Unassigned
- ❌ No due date

### Branch Management

**One Issue = One Branch = One PR**

Don't:
- ❌ Put multiple issues in one PR
- ❌ Create branch without Linear issue
- ❌ Leave branches open for weeks
- ❌ Merge without Linear reference

Do:
- ✅ Create branch from Linear
- ✅ Small, focused changes
- ✅ Merge quickly (within days)
- ✅ Delete branch after merge

### Commit Hygiene

**Every commit references Linear:**

```bash
# Good
LIN-123: Add user authentication
LIN-123: Fix password validation bug
LIN-123: Update tests for auth flow

# Bad (will be rejected by hooks)
Fix bug
Update stuff
WIP
```

---

## Troubleshooting

### Issue not linking to PR

**Problem:** PR created but Linear issue doesn't show it.

**Solutions:**
1. Check PR title format: `[LIN-XXX] Description`
2. Verify Linear ID exists
3. Check webhook delivery (GitHub → Settings → Webhooks)
4. Manually add reference in Linear

### Status not updating

**Problem:** Merged PR but Linear issue still "In Review".

**Solutions:**
1. Check webhook is active
2. Verify workflow mapping in Linear
3. Manually move status (one-time fix)
4. Check for webhook errors

### Branch naming conflicts

**Problem:** Linear suggests branch name already exists.

**Solutions:**
1. Delete old branch if no longer needed
2. Use descriptive suffix: `feature/LIN-123-add-auth-v2`
3. Clean up old branches regularly

### Integration stopped working

**Problem:** Was working, now stopped.

**Solutions:**
1. Check Linear integration settings
2. Re-authorize GitHub access
3. Check webhook delivery status
4. Reinstall integration if needed

---

## Automation Ideas

### GitHub Actions + Linear

**Auto-assign reviewer based on issue labels:**

```yaml
name: Auto-assign Reviewer
on:
  pull_request:
    types: [opened]

jobs:
  assign:
    runs-on: ubuntu-latest
    steps:
      - name: Get Linear issue details
        run: |
          # Fetch issue labels from Linear API
          # Assign reviewer based on labels
```

**Auto-comment on Linear when PR merged:**

```yaml
name: Notify Linear on Merge
on:
  pull_request:
    types: [closed]

jobs:
  notify:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: Comment on Linear
        run: |
          # POST comment to Linear API
          # "Deployed to production on [date]"
```

### Slack Notifications

**Linear + Slack integration:**

1. Linear → Settings → Integrations → Slack
2. Connect workspace
3. Configure notifications:
   - Issue created
   - PR opened
   - PR merged
   - Issue status changes

---

## Analytics & Reporting

### Velocity Tracking

**Track team velocity in Linear:**

1. Linear → Cycles
2. Create cycles (sprints)
3. Assign issues to cycles
4. View cycle analytics:
   - Issues completed
   - Average cycle time
   - Completion rate

### PR Lead Time

**Measure time from issue creation to merge:**

Linear shows this automatically in issue history.

**Target metrics:**
- Bug fixes: < 2 days
- Small features: < 1 week
- Large features: < 2 weeks

### Code Review Time

**Track time in "In Review" state:**

Linear workflow analytics show:
- Average review time
- Issues stuck in review
- Review bottlenecks

---

## Migration from Other Tools

### From Jira

**Export Jira issues:**
1. Jira → Issues → Export
2. Save as CSV

**Import to Linear:**
1. Linear → Settings → Import
2. Select Jira CSV
3. Map fields
4. Import

**Update branch naming:**
- Old: `feature/PROJ-123-description`
- New: `feature/LIN-123-description`

Update `.husky/commit-msg` if needed.

### From GitHub Issues

**Sync existing issues:**
1. Linear → Settings → Integrations → GitHub
2. Enable "Import GitHub Issues"
3. Select issues to import
4. Map to Linear project

**Update workflow:**
- Remind team to use Linear, not GitHub Issues
- Close GitHub Issues tab
- Update issue templates

---

## Security Considerations

### Access Control

**Who can see what:**

**Linear:**
- Workspace members: Full access
- Guests: Limited access (if invited)

**GitHub:**
- Repository access determines Linear visibility
- Private repo = Private Linear issues

### Sensitive Issues

**Handling security/privacy issues:**

1. Create issue in Linear
2. Mark as "Private" or "Internal"
3. Don't include sensitive details in title
4. Link to secure documentation
5. Limit who can view

### Audit Trail

**Linear maintains history:**
- All status changes logged
- All comments preserved
- All links tracked

**For compliance:**
- Export data regularly
- Archive old issues
- Document retention policy

---

## Quick Reference

**Create Issue:**
```
Linear → New Issue
Title: Clear, specific description
Description: Details and acceptance criteria
Labels: bug/feature/urgent
Assignee: Yourself or teammate
Due: Target date
```

**Create Branch:**
```
Linear issue → Click "Create branch"
Copy: git checkout -b feature/LIN-XXX-description
```

**Commit:**
```bash
git commit -m "LIN-XXX: Description"
```

**Create PR:**
```
GitHub → New Pull Request
Title: [LIN-XXX] Description
Template: Fill out completely
Reviewers: Assign at least 1
```

**Status Flow:**
```
Todo → In Progress → In Review → Ready to Merge → Done
```

---

## Resources

**Linear Documentation:**
- https://linear.app/docs

**GitHub Integration:**
- https://linear.app/docs/github-integration

**API Reference:**
- https://developers.linear.app/docs/

**Team Support:**
- Linear Slack community
- GitHub community forums

---

**Questions?** Ask in #dev-questions or check Linear documentation.

**Last Updated:** 2026-01-30
