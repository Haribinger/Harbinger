# BRIEF — Tool Arsenal

> Every tool listed here is installed in your Docker container and ready to use.

## Tool Philosophy

Aggregate fast, format beautifully, deliver reliably. You pull from many sources and produce one unified output. Every tool serves the brief — either it provides data or it helps present data.

## Primary Tools

### newsboat / feedparser
- **Purpose:** RSS feed parsing for security news aggregation
- **Category:** Data Collection — News Feeds
```bash
# Parse RSS feeds
newsboat -r -u /workspace/feeds.txt
python3 -c "import feedparser; f=feedparser.parse('https://feeds.feedburner.com/TheHackersNews'); print(f.entries[0].title)"
```

### playwright / puppeteer
- **Purpose:** Browser-based web scraping for news and content
- **Category:** Data Collection — Web Scraping
```bash
# Scrape news page via Harbinger API
curl -X POST {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/navigate \
  -d '{"url": "https://thehackernews.com"}'
curl {{HARBINGER_API}}/api/browser/sessions/{{session_id}}/screenshot
```

### pandoc
- **Purpose:** Markdown to HTML/PDF conversion for brief output
- **Category:** Formatting — Document Conversion
```bash
pandoc brief.md -o brief.html --template=harbinger-brief.html --self-contained
pandoc brief.md -o brief.pdf --template=harbinger-brief.latex
```

### mermaid-cli (mmdc)
- **Purpose:** Generate charts and diagrams for visual briefs
- **Category:** Formatting — Diagram Generation
```bash
mmdc -i agent-status.mmd -o status-chart.png -t dark
mmdc -i task-flow.mmd -o flow.svg
```

### curl
- **Purpose:** API requests for channel delivery and agent polling
- **Category:** Distribution — API Access
```bash
# Send Discord webhook
curl -X POST "https://discord.com/api/webhooks/ID/TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Morning Brief", "embeds": [...]}'

# Send Telegram message
curl -X POST "https://api.telegram.org/botTOKEN/sendMessage" \
  -d '{"chat_id": "CHAT_ID", "text": "Morning Brief", "parse_mode": "Markdown"}'

# Send Slack webhook
curl -X POST "https://hooks.slack.com/services/T/B/X" \
  -H "Content-Type: application/json" \
  -d '{"text": "Morning Brief", "blocks": [...]}'
```

### jq
- **Purpose:** JSON processing for API response parsing
- **Category:** Data Processing
```bash
# Parse agent statuses
curl -s {{HARBINGER_API}}/api/agents | jq '.[] | {name, status, last_heartbeat}'
# Extract CVE data
curl -s "https://cve.circl.lu/api/last" | jq '.[0:5] | .[] | {id, summary}'
```

### cron
- **Purpose:** Schedule brief generation
- **Category:** Scheduling
```bash
# Crontab entry (already configured in CONFIG.yaml)
# 0 8 * * * /workspace/generate-brief.sh
```

## Docker Tools

```bash
# Spawn web scraper
curl -X POST {{HARBINGER_API}}/api/docker/containers \
  -d '{"image": "harbinger/reporter-agent", "cmd": "python3 scrape-news.py", "auto_remove": true}'

# Generate charts in sub-container
curl -X POST {{HARBINGER_API}}/api/docker/containers \
  -d '{"image": "harbinger/mermaid", "cmd": "mmdc -i charts.mmd -o charts.png", "auto_remove": true}'

curl {{HARBINGER_API}}/api/docker/containers
```

## Harbinger API Access

```bash
# Poll all agent heartbeats
curl {{HARBINGER_API}}/api/agents

# Get overnight findings
curl "{{HARBINGER_API}}/api/findings?since=24h"

# Get SAGE's overnight report
curl "{{HARBINGER_API}}/api/agents/sage/report"

# Broadcast brief completion
curl -X POST {{HARBINGER_API}}/api/agents/broadcast \
  -d '{"from": "brief", "message": "Morning brief delivered to all channels", "priority": "info"}'
```
