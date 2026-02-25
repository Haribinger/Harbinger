Primary: theharvester, sherlock, maigret, holehe, ghunt, social-analyzer, spiderfoot, maltego-ce, h8mail, emailfinder, whois, dnsrecon, metagoofil, exiftool, photon. Each with usage examples.

### Usage Examples:

**theharvester**
```bash
theharvester -d example.com -l 500 -b google
```

**sherlock**
```bash
sherlock username
```

**maigret**
```bash
maigret username
```

**holehe**
```bash
holehe user@example.com
```

**ghunt**
```bash
ghunt email@gmail.com
```

**social-analyzer**
```bash
social-analyzer --username username
```

**spiderfoot**
```bash
spiderfoot -s example.com -m all
```

**maltego-ce**
```bash
# Maltego is a GUI tool, typically used interactively.
# Command line usage is for specific integrations or headless operations.
# Example for running a transform via command line (requires Maltego CLI setup):
maltego-cli run-transform com.maltego.transforms.v2.email.to.person -entity email.address=user@example.com
```

**h8mail**
```bash
h8mail -t targets.txt -l leaks.txt
```

**emailfinder**
```bash
emailfinder example.com
```

**whois**
```bash
whois example.com
```

**dnsrecon**
```bash
dnsrecon -d example.com -t std,brt,srv
```

**metagoofil**
```bash
metagoofil -d example.com -t pdf,doc,xls -l 200 -o output.html
```

**exiftool**
```bash
exiftool image.jpg
```

**photon**
```bash
photon -u https://example.com
```
