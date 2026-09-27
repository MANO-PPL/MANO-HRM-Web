# Tutorial: Getting Started (Local Dev Setup)

> Place this file at /docs/onboarding.md. This is the ONE tutorial (Diataxis)
> doc in the repo, written for someone who has never touched the codebase.
> Unlike how-to guides, it's okay to explain a little "why" here so a
> newcomer builds a real mental model, not just a working setup.
> Keep this current — it's the first thing every new hire runs.

## What you'll have by the end
A working local copy of [backend / mobile app], running against
[local / dev / staging] data, able to make a change and see it live.

## 1. Prerequisites
- Tools and versions needed (Node, MongoDB, Flutter SDK, AWS CLI, etc.)

## 2. Clone and install
```bash
git clone <repo-url>
cd <repo>
npm install
```

## 3. Environment setup
Where to get `.env` values / secrets, and who to ask for access.

## 4. Run it locally
```bash
npm run dev
```
What you should see on screen when it's working correctly.

## 5. Make your first change
A small, safe, real change (e.g. edit a piece of UI text). Commit it,
open a PR, and go through the review flow — this teaches the team's
actual process, not just the code.

## 6. Where to go next
- Module facts: `/src/modules/*/README.md` (Reference)
- Business context per feature: `/docs/features/` (Explanation)
- Why things are built a certain way: `/docs/adr/` (Decisions)
- Common tasks: `/docs/how-to/` (How-to)
