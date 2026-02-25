# Ghidra Workflows for CIPHER

## Project Setup

```bash
# GUI launch
ghidraRun

# Headless batch analysis
analyzeHeadless /tmp/ghidra_projects MyProject \
  -import ./target_binary \
  -overwrite \
  -postScript PrintASM.java 2>/dev/null
```

## Key Navigation

| Action | Shortcut |
|--------|----------|
| Go to address | G |
| Search for string | Alt+\ |
| Decompiler view | Ctrl+E |
| Create function | F |
| Rename symbol | L |
| Add comment | ; |
| Cross-references | Ctrl+Shift+F |
| Jump to definition | Ctrl+Click |

## Finding Interesting Functions

1. Window → Symbol Tree → Functions — sort by name, look for `check_`, `auth_`, `decrypt_`
2. Search → For Strings → search `password`, `flag`, `key`
3. Window → Defined Strings → export, grep interesting ones
4. References (xrefs) on `strcmp`, `memcmp`, `strcpy` — these are gold

## Decompiler Tips

- `Right-click variable → Retype Variable` — fix wrong types for cleaner output
- `Right-click → Auto Create Structure` — auto-build struct from field access patterns
- Use `Edit → Tool Options → Decompiler` to enable aggressive analysis

## Script Automation

```python
# Ghidra Python script (run via Script Manager)
from ghidra.program.model.listing import CodeUnit

fm = currentProgram.getFunctionManager()
for func in fm.getFunctions(True):
    if "check" in func.getName().lower():
        print(func.getName(), func.getEntryPoint())
```
