Primary: markdown, pandoc, mermaid (diagrams), screenshot tools, video recording, HTML/PDF templates, HackerOne API, Bugcrowd API, Intigriti API. Each with usage examples.

### Usage Examples:

**markdown**
```bash
# Markdown is a markup language, not a command-line tool itself.
# It's used for writing content, which can then be processed by other tools.
# Example: A simple markdown file content
# # My Report\n\nThis is a **test** report.
```

**pandoc**
```bash
pandoc input.md -o output.pdf
```

**mermaid (diagrams)**
```bash
# Mermaid is a JavaScript-based diagramming tool. It's typically integrated into markdown renderers or web applications.
# Example of Mermaid syntax within a markdown file:
# ```mermaid
# graph TD;
#     A-->B;
#     A-->C;
#     B-->D;
#     C-->D;
# ```
```

**screenshot tools**
```bash
# Example using scrot (a common Linux screenshot tool)
scrot -s -o screenshot.png
```

**video recording**
```bash
# Example using ffmpeg (a powerful multimedia tool)
ffmpeg -f x11grab -s 1920x1080 -i :0.0 -c:v libx264 -preset ultrafast -crf 23 output.mp4
```

**HTML/PDF templates**
```bash
# These are typically files used by other tools (like pandoc or custom scripts) for rendering.
# Example: Using a custom HTML template with pandoc
pandoc input.md -o output.html --template=custom_template.html
```

**HackerOne API**
```bash
# Interacting with HackerOne API typically involves making HTTP requests with an API key.
# Example using curl (conceptual, actual API calls vary):
curl -X GET -H "X-Auth-Token: YOUR_API_TOKEN" https://api.hackerone.com/v1/reports
```

**Bugcrowd API**
```bash
# Interacting with Bugcrowd API typically involves making HTTP requests with an API key.
# Example using curl (conceptual, actual API calls vary):
curl -X GET -H "Authorization: Token token=YOUR_API_TOKEN" https://api.bugcrowd.com/v3/submissions
```

**Intigriti API**
```bash
# Interacting with Intigriti API typically involves making HTTP requests with an API key.
# Example using curl (conceptual, actual API calls vary):
curl -X GET -H "Authorization: Bearer YOUR_API_TOKEN" https://api.intigriti.com/v1/submissions
```
