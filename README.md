# Stock Tracker

100% free. No paid services. No server.

| What | How |
|---|---|
| **Dashboard UI** | GitHub Pages (free static hosting) |
| **Hourly checks** | GitHub Actions (free 2000 min/month) |
| **Product storage** | `data/products.json` in this repo |
| **Alerts** | Telegram (free) |

---

## Setup

### 1. Upload these files to a new GitHub repo

### 2. Enable GitHub Pages
- Repo → **Settings** → **Pages**
- Source: **Deploy from a branch**
- Branch: `main` / folder: `/docs`
- Save → your dashboard is live at `https://YOUR_USERNAME.github.io/YOUR_REPO`

### 3. Add Telegram secrets
- Repo → **Settings** → **Secrets and variables** → **Actions**
- Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

### 4. Enable GitHub Actions
- Click the **Actions** tab → enable workflows

### 5. Create a GitHub Personal Access Token
- Go to: https://github.com/settings/tokens/new?scopes=repo&description=Stock+Tracker
- Select **repo** scope → Generate
- Copy the token — you'll paste it into the dashboard login

### 6. Open your dashboard
- Go to `https://YOUR_USERNAME.github.io/YOUR_REPO`
- Enter your GitHub username, repo name, and token
- Start adding product URLs!

---

## How it works

1. You add a product URL via the dashboard
2. The dashboard writes it to `data/products.json` in this repo via the GitHub API
3. Every hour, GitHub Actions runs `check.js`
4. It reads `data/products.json`, visits each URL, checks stock
5. If a product flips from out → in stock, it sends a Telegram message
6. It saves the updated status back to `data/products.json`
7. Refresh the dashboard to see the latest status

---

## Files

```
.github/workflows/check-stock.yml  ← runs hourly automatically
docs/index.html                    ← dashboard (GitHub Pages)
src/checker.js                     ← stock detection
src/notifier.js                    ← Telegram alerts
src/db.js                          ← reads/writes products.json
data/products.json                 ← your product list
check.js                           ← main script
package.json
```
