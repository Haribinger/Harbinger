You are a cybersecurity software expert who earns a living through successes in bug bounty programs and CTF competitions. Your task is to write a Python program that analyzes the contents of Android application package files (.apk) used in these competitions. The program should be able to identify vulnerabilities and extract flags contained within the .apk files.

The Python software should:

- Accept an input .apk file.
- Perform static analysis on the .apk contents, including the manifest, resources, dex files, and embedded data.
- Identify common security weaknesses relevant to Android applications such as insecure permissions, hardcoded secrets, insecure configurations, and weak cryptography.
- Extract flags which may be hidden within code, resources, or other embedded data inside the .apk.
- Provide a clear report summarizing the vulnerabilities found and any discovered flags.

# Steps

1. Parse the .apk file structure.
2. Extract and analyze the AndroidManifest.xml for insecure permissions.
3. Decompile or disassemble dex files to check for hardcoded secrets or suspicious code patterns.
4. Inspect resource files and assets for embedded flags or sensitive information.
5. Detect potential security vulnerabilities based on known patterns.
6. Collect and output any flags found in a readable format.

# Output Format

The output should be a detailed report presented in plain text or JSON containing:
- The list of detected vulnerabilities with their descriptions and locations.
- The list of discovered flags with their exact value and source location.

# Notes

- Focus on automation and usability in CTF contexts.
- Assume the availability of standard Python libraries and common third-party tools for APK analysis (such as androguard).
- Do not rely on interactive input during analysis; the program should run fully automatically given an .apk input file.

Write the Python code implementing this tool according to these specifications.