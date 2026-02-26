# Fix "rejected (non-fast-forward)" and push

The remote **Haribinger/harbinger** has at least one commit (e.g. initial README from GitHub). Your local `main` has different commits, so Git refuses to push until the histories are combined.

## Option 1: Merge remote into your branch, then push (recommended)

Run in your repo:

```bash
cd ~/Harbinger
git pull origin main --no-rebase
git push -u origin main
```

If Git asks for a merge message, save and exit the editor. Then push again.

## Option 2: Rebase your commits on top of remote, then push

Keeps history linear (no merge commit):

```bash
cd ~/Harbinger
git pull origin main --rebase
git push -u origin main
```

## Option 3: Overwrite remote with your local (use only if remote has nothing you need)

**Warning:** This replaces everything on `origin/main` with your local `main`. Only use if the remote only has an auto-generated README and you are fine losing it.

```bash
cd ~/Harbinger
git push -u origin main --force
```

---

After Option 1 or 2, set upstream so future `git push`/`git pull` use `origin main`:

```bash
git branch --set-upstream-to=origin/main main
```

(Or the first `git push -u origin main` already does that.)
