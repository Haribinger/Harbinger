# LENS — Tool Arsenal

> Every tool listed here is installed in your Docker container and ready to use.

## Tool Philosophy

See the web as the user sees it. No curl approximations, no raw HTML parsing. Real browser rendering with real JavaScript execution. The browser is your primary tool — CDP is your API. Everything else is secondary.

## Primary Tool: Chrome DevTools Protocol (CDP)

LENS operates primarily through the Harbinger Browser API, which wraps Chrome DevTools Protocol:

### Navigate
```bash
# Navigate to a URL
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/navigate \
  -d '{"url": "https://target.com"}'

# Navigate and wait for network idle
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/navigate \
  -d '{"url": "https://target.com/app", "wait_for": "networkidle"}'
```

### Screenshot
```bash
# Full page screenshot
curl {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/screenshot \
  -o screenshot.png

# Element-specific screenshot
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/screenshot \
  -d '{"selector": "#login-form"}' -o login-form.png

# Full page (scrolling) screenshot
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/screenshot \
  -d '{"full_page": true}' -o full-page.png
```

### Click
```bash
# Click element by CSS selector
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/click \
  -d '{"selector": "#login-button"}'

# Click by coordinates
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/click \
  -d '{"x": 500, "y": 300}'

# Click and wait for navigation
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/click \
  -d '{"selector": "a.next-page", "wait_for": "navigation"}'
```

### Type
```bash
# Type into input field
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/type \
  -d '{"selector": "#username", "text": "admin"}'

# Type with delay (human-like)
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/type \
  -d '{"selector": "#password", "text": "password123", "delay": 50}'

# Clear and type
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/type \
  -d '{"selector": "#search", "text": "new query", "clear": true}'
```

### Execute JavaScript
```bash
# Run JavaScript in page context
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/execute \
  -d '{"script": "document.querySelectorAll(\"input\").length"}'

# Extract data from page
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/execute \
  -d '{"script": "JSON.stringify(Object.keys(localStorage))"}'

# Modify DOM
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/execute \
  -d '{"script": "document.querySelector(\"#hidden-panel\").style.display = \"block\""}'

# Read cookies
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/execute \
  -d '{"script": "document.cookie"}'
```

### Network Traffic
```bash
# Get network log (all requests during session)
curl {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/network

# Get XHR/fetch requests only
curl "{{HARBINGER_API}}/api/browser/sessions/{{session_id}}/network?type=xhr"

# Get request/response bodies
curl "{{HARBINGER_API}}/api/browser/sessions/{{session_id}}/network?include_body=true"
```

### Console Log
```bash
# Get console output
curl {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/console

# Get errors only
curl "{{HARBINGER_API}}/api/browser/sessions/{{session_id}}/console?level=error"
```

### Session Management
```bash
# Create new browser session
curl -X POST {{HARBINGER_API}}/api/browser/sessions \
  -d '{"agent": "lens"}'

# List active sessions
curl {{HARBINGER_API}}/api/browser/sessions

# Close session
curl -X DELETE {{HARBINGER_API}}/api/browser/sessions/{{session_id}}

# Reset session (clear cookies, storage, cache)
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/reset
```

## Supporting Tools

### Playwright (Node.js)
- **Purpose:** High-level browser automation when CDP is too low-level
```javascript
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = await browser.newPage();
await page.goto('https://target.com');
await page.screenshot({ path: 'screenshot.png' });
```

### Puppeteer
- **Purpose:** Chrome-specific automation alternative
```javascript
const puppeteer = require('puppeteer');
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
const page = await browser.newPage();
await page.goto('https://target.com');
```

### curl
- **Purpose:** Fallback for simple HTTP requests when browser isn't needed
```bash
curl -s https://target.com/api/endpoint -H "Cookie: session=abc"
```

### jq
- **Purpose:** Parse network traffic and DOM data
```bash
curl -s {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/network | jq '.[] | select(.url | contains("api"))'
```

## Docker Tools

```bash
# Spawn additional browser session
curl -X POST {{HARBINGER_API}}/api/docker/containers \
  -d '{"image": "harbinger/browser-agent", "cmd": "chrome --headless --remote-debugging-port=9223", "auto_remove": true}'

# Screenshot service for parallel captures
curl -X POST {{HARBINGER_API}}/api/docker/containers \
  -d '{"image": "harbinger/browser-agent", "cmd": "screenshot-service --urls urls.txt --output /shared/screenshots/", "auto_remove": true}'

curl {{HARBINGER_API}}/api/docker/containers
```

## Harbinger API Access

```bash
# Report discovered endpoint from network traffic
curl -X POST {{HARBINGER_API}}/api/findings \
  -d '{"agent": "lens", "type": "api_endpoint", "severity": "info", "data": {"url": "https://target.com/api/v2/admin", "method": "POST"}}'

# Share authenticated session with BREACH
curl -X POST {{HARBINGER_API}}/api/agents/broadcast \
  -d '{"from": "lens", "message": "Authenticated session ready for target.com - session ID: abc123", "priority": "info"}'

# Hand off visual evidence to SCRIBE
curl -X POST {{HARBINGER_API}}/api/jobs \
  -d '{"agent_type": "report", "task": "include_evidence", "data": {"screenshots": ["/shared/screenshots/vuln-1.png"]}}'
```
