# SSH setup so push uses your Haribinger key

Your repo is **Haribinger/harbinger**. Push was "denied to kdairatchi" because Git used your default SSH key (kdairatchi), not the key you added to the **Haribinger** account (e.g. `~/.ssh/id_ed255192`).

## 1. Add this to `~/.ssh/config`

Create or edit `~/.ssh/config` and add:

```
Host github-harbinger
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed255192
```

Use the key you added to the Haribinger GitHub account (here `id_ed255192`).

## 2. Remote is already set

Your origin is:

```
git@github-harbinger:Haribinger/harbinger.git
```

So Git will use the `github-harbinger` host and thus the key above.

## 3. Push

```bash
cd ~/Harbinger
git push -u origin main
```

## If you don't use an alias

If you prefer not to use `github-harbinger`, you can make your **default** key the one for Haribinger (e.g. only have `id_ed255192` and use it for GitHub). Then set:

```bash
git remote set-url origin git@github.com:Haribinger/harbinger.git
```

and push. That uses whatever key SSH uses by default for github.com.
