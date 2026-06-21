# Publishing To GitHub

The intended public repository is Juan's personal account:

```text
https://github.com/juansuero/raqet
```

This working tree already uses the personal SSH remote:

```powershell
git remote -v
# origin  git@github-personal:juansuero/raqet.git (fetch)
# origin  git@github-personal:juansuero/raqet.git (push)
```

Current machine check:

- `ssh -T git@github-personal` authenticates as `juansuero`.
- `gh auth status` currently reports the active GitHub CLI account as `veltastech`.

That means normal `git push` through the SSH remote uses the personal account, but `gh repo create` and `gh release create` need GitHub CLI switched to `juansuero` first.

## Fast Path

If the repo already exists and the remote is correct:

```powershell
ssh -T git@github-personal
git push -u origin main
```

## Set The Personal Remote

From the self-hosted repo:

```powershell
git remote set-url origin git@github-personal:juansuero/raqet.git
git remote -v
```

Use this when the clone still points to a work account or organization remote.

## Create The Personal Repo With GitHub CLI

Use this only when `gh auth status` shows the personal account.

```powershell
gh auth status
gh repo create juansuero/raqet --public --source=. --remote=origin --push --description "Self-hosted solo tennis journal and video review app"
```

If GitHub CLI is authenticated as the work account, either switch to an already configured personal login:

```powershell
gh auth switch --hostname github.com --user juansuero
```

or log out and log back in as the personal account:

```powershell
gh auth logout -h github.com
gh auth login -h github.com -p ssh
```

Then repeat `gh auth status`.

## First Release

Before tagging:

```powershell
npm.cmd run typecheck
npm.cmd run build
git status --short
```

After verification:

```powershell
git tag v0.1.0
git push origin main
git push origin v0.1.0
gh release create v0.1.0 --title "Raqet v0.1.0" --notes-file CHANGELOG.md
```

Do not publish local databases, videos, `.env`, logs, `.next`, or `node_modules`.
