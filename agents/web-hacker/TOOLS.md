Primary: nuclei, sqlmap, dalfox, ffuf, feroxbuster, burpsuite, xsstrike, nosqlmap, ssrfmap, commix, tplmap, jwt_tool, arjun, paramspider, corstest, dirsearch. Each with usage examples.

### Usage Examples:

**nuclei**
```bash
nuclei -u https://example.com -t cves/
```

**sqlmap**
```bash
sqlmap -u "http://example.com/vuln?id=1" --batch
```

**dalfox**
```bash
dalfox url https://example.com
```

**ffuf**
```bash
ffuf -w /path/to/wordlist.txt -u https://example.com/FUZZ
```

**feroxbuster**
```bash
feroxbuster -u https://example.com
```

**burpsuite**
```bash
# Burp Suite is a GUI tool, typically used interactively.
# Command line usage is for specific integrations or headless scans.
# Example for headless scan (requires Burp Suite Professional and API setup):
java -jar burpsuite_pro.jar --project-file=project.burp --headless.mode=scan --url=https://example.com
```

**xsstrike**
```bash
xsstrike -u "https://example.com/search?q=test"
```

**nosqlmap**
```bash
nosqlmap -u "http://example.com/api/v1/user" --data "{'username':'admin'}"
```

**ssrfmap**
```bash
ssrfmap -r request.txt -p "url"
```

**commix**
```bash
commix -u "http://example.com/cmd?input=test"
```

**tplmap**
```bash
tplmap -u "http://example.com/template?name=test"
```

**jwt_tool**
```bash
jwt_tool -t eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c -X a
```

**arjun**
```bash
arjun -u https://example.com/api/v1/users
```

**paramspider**
```bash
paramspider -d example.com
```

**corstest**
```bash
corstest -u https://example.com
```

**dirsearch**
```bash
dirsearch -u https://example.com -e php,html,js
```
