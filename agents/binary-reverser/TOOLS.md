Primary: ghidra, radare2, cutter, binwalk, pwntools, ropgadget, angr, z3, strace, ltrace, gdb, objdump, strings, file, checksec. Each with usage examples.

### Usage Examples:

**ghidra**
```bash
# Ghidra is a GUI tool, typically used interactively.
# Headless analyzer example:
./analyzeHeadless <project_dir> <project_name> -import <binary_path>
```

**radare2**
```bash
radare2 -A /bin/ls
```

**cutter**
```bash
# Cutter is a GUI tool, typically used interactively.
# Command line usage is for specific integrations or scripting.
# Example for scripting with r2pipe:
python -c 'import r2pipe; r2 = r2pipe.open("/bin/ls"); print(r2.cmd("pd 20"))'
```

**binwalk**
```bash
binwalk -Me firmware.bin
```

**pwntools**
```python
from pwn import *
# Example: connect to a remote service
r = remote('example.com', 1234)
r.sendline(b'hello')
r.recvline()
```

**ropgadget**
```bash
ROPgadget --binary /bin/ls --only "pop|ret"
```

**angr**
```python
import angr
# Example: basic symbolic execution
p = angr.Project('/bin/ls')
state = p.factory.entry_state()
simgr = p.factory.simulation_manager(state)
simgr.explore(find=0x400000)
```

**z3**
```python
from z3 import *
# Example: solve a simple equation
x = Int('x')
s = Solver()
s.add(x > 10, x < 20, x % 2 == 0)
print(s.check())
print(s.model())
```

**strace**
```bash
strace ls
```

**ltrace**
```bash
ltrace ls
```

**gdb**
```bash
gdb -q /bin/ls
# Inside gdb: b main, r, info registers
```

**objdump**
```bash
objdump -d /bin/ls
```

**strings**
```bash
strings /bin/ls
```

**file**
```bash
file /bin/ls
```

**checksec**
```bash
checksec --file=/bin/ls
```
