# Contributing to exogui

Thanks for your interest in contributing! Here's what you need to know.

## Community

The primary place for discussion, task coordination, and bug tracking is the [exogui Discord](https://discord.gg/yMcZnyUn). If you have questions, want to discuss a feature idea before building it, or need help getting your dev environment set up — that's the place.

GitHub Issues are available as a secondary channel, mainly for users who want to report bugs but prefer not to use Discord.

## Workflow

We follow a standard feature branch workflow:

1. Fork the repo and create a branch off `develop`
2. Make your changes
3. Open a PR targeting `develop`
4. Once reviewed and merged, changes will be included in the next release when an administrator merges `develop` into `master` — the version is bumped automatically at that point

## Opening a PR

Be brief but informative. A one-liner isn't enough — describe what you changed and why, and call out anything non-obvious like tradeoffs, known limitations, or areas you're unsure about. If there are steps needed to test the change, include them.

No formal PR template, just use your judgement.

## Unsolicited Contributions

If you built something on your own — a new feature, an improvement, whatever — feel free to open a PR. We can't guarantee it'll be merged, but we're happy to take a look and discuss it. Discord is a good place to get early feedback before investing too much time.

## Code Style

- Run `npm run lint:fix` before submitting — we use ESLint for both code quality and formatting
- Avoid unnecessary comments; prefer clear variable and function names
- Use conventional commit format for commit messages (`feat:`, `fix:`, `chore:`, etc.)

## Tests

Writing tests for your changes is appreciated but not required. If your change touches existing tests, make sure they still pass (`npm test`).

## Development Setup

See the [README](README.md) for setup instructions and common commands.
