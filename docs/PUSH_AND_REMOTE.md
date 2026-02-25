# Push to GitHub

## Current state

- **Initial commit is done** with no secrets (`.env`, `.env.local` are in `.gitignore` and were never committed).
- **Remote:** `origin` is set to `git@github-kdairatchi:kdairatchi/harbinger.git` (your SSH host alias).
- **Branch:** `main`.

## If you want to push to Harbinger/Harbinger

```bash
cd ~/Harbinger
git remote set-url origin git@github.com:Harbinger/Harbinger.git
git push -u origin main
```

(Use `git@github-kdairatchi:Harbinger/Harbinger.git` if you use the `github-kdairatchi` SSH host for GitHub.)

## If push fails with SSH errors

Example: `Bad owner or permissions on /etc/ssh/ssh_config.d/...` or `Could not read from remote repository`.

1. Fix SSH config permissions (often needs sudo), or
2. Use HTTPS instead:
   ```bash
   git remote set-url origin https://github.com/Harbinger/Harbinger.git
   git push -u origin main
   ```
   (You may be prompted for GitHub username and a personal access token.)

## Git identity (already set for this repo)

- `user.name`: Harbinger  
- `user.email`: harbinger@localhost  

To use your own name/email for future commits:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```
