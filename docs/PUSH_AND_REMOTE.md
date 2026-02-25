# Push to GitHub

## Remote (no SSH alias needed)

- **origin:** `git@github.com:harbinger/harbinger.git`
- Uses your default GitHub SSH key (same as `ssh -T git@github.com`).

## Push

```bash
cd ~/Harbinger
git push -u origin main
```

## If you get "Author identity unknown"

Set your name and email for this repo (or use `--global` for all repos):

```bash
cd ~/Harbinger
git config user.name "Your Name"
git config user.email "you@example.com"
```

Then commit again if needed, and push.

## If you get "embedded git repository: Harbinger" or "hexstrike-ai"

That means nested `.git` folders are being added as submodules. To fix:

```bash
cd ~/Harbinger
git reset
rm -rf Harbinger/.git mcp-plugins/hexstrike-ai/.git
git add -A
git config user.name "Your Name"
git config user.email "you@example.com"
git commit -m "Initial commit: Harbinger platform, no secrets"
git push -u origin main
```

(Ensure root `.gitignore` exists and includes `.env`, `.env.*`, `node_modules/`, etc., so secrets and build artifacts are not committed.)

## If SSH still fails: use HTTPS

```bash
git remote set-url origin https://github.com/harbinger/harbinger.git
git push -u origin main
```

Use your GitHub username and a personal access token when prompted.
