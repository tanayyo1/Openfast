# Contributing to ReditFast

Thank you for your interest in contributing to ReditFast! We welcome contributions from the community.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/ReditFast.git
   cd ReditFast
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```
5. **Set up database**
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```
6. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📋 Development Workflow

### Before You Start

- Check existing [issues](https://github.com/tanayyo1/ReditFast/issues) or [discussions](https://github.com/tanayyo1/ReditFast/discussions)
- For major changes, open an issue first to discuss your proposal
- Comment on issues you'd like to work on

### Coding Standards

We use:
- **TypeScript** - Strict mode enabled
- **ESLint** - For code quality
- **Prettier** - For code formatting
- **Husky** - For git hooks

Run checks before committing:
```bash
npm run lint
npm run typecheck
npm run format:check
```

### Code Style

- Use meaningful variable names
- Add JSDoc comments for public functions
- Keep functions small and focused
- Use early returns to avoid nesting
- Prefer `const` over `let`

### Testing

All contributions should include tests:

```bash
# Unit tests for services/utilities
npm run test:unit

# Integration tests for API routes
npm run test:integration

# E2E tests for critical flows
npm run test:e2e
```

### Commit Messages

Use conventional commits:

```
feat: add new feature
fix: fix a bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add or update tests
chore: maintenance tasks
```

Example:
```
feat(roadmap): add support for custom task durations

- Added duration field to RoadmapTask model
- Updated UI to show estimated time
- Added validation for realistic durations
```

## 🔧 Areas for Contribution

### High Priority
- [ ] Subreddit intelligence improvements
- [ ] Better compliance scoring
- [ ] Analytics dashboard enhancements
- [ ] Mobile responsiveness
- [ ] Performance optimizations

### Medium Priority
- [ ] Additional integrations (LinkedIn, X)
- [ ] Team collaboration features
- [ ] Advanced scheduling options
- [ ] Content templates library
- [ ] API documentation improvements

### Documentation
- [ ] Tutorials and guides
- [ ] Video walkthroughs
- [ ] Example use cases
- [ ] Translation contributions

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Clear title** - Summarize the issue
2. **Description** - What happened vs. what you expected
3. **Steps to reproduce** - Numbered list
4. **Environment** - OS, browser, Node version
5. **Screenshots** - If applicable
6. **Error logs** - Console output, stack traces

Example:
```
Title: Scheduled posts not appearing in dashboard

Description:
After scheduling a post, it doesn't show up in the dashboard until I refresh the page.

Steps:
1. Create a new draft
2. Click "Schedule Post"
3. Select time and confirm
4. Navigate to dashboard

Expected: Post appears in scheduled list
Actual: List is empty until page refresh

Environment:
- OS: macOS 14.2
- Browser: Chrome 120.0
- Node: 18.17.0
```

## 💡 Suggesting Features

Feature requests should:

1. **Describe the problem** - What pain point does this solve?
2. **Propose a solution** - How should it work?
3. **Consider alternatives** - What else could work?
4. **Note context** - Who would benefit?

## 🔒 Security

**DO NOT** create public issues for security vulnerabilities.

Instead:
- Email security concerns to: security@reditfast.com
- Include detailed reproduction steps
- Allow time for response before disclosure

## 📜 Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information
- Other unethical conduct

## 📝 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be:
- Listed in our README
- Mentioned in release notes
- Invited to our community Discord (coming soon)

## 📞 Questions?

- GitHub Discussions: [Join here](https://github.com/tanayyo1/ReditFast/discussions)
- Email: hello@reditfast.com
- Twitter: [@ReditFast](https://twitter.com/ReditFast)

---

Thank you for helping make ReditFast better! 🚀
