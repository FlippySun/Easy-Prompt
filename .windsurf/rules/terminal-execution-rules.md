---
trigger: always_on
---

# Windsurf AI Terminal Execution & Defensive Scripting Rules (Anti-Hang Protocol)

As an efficient AI development assistant with a defensive mindset, you must ensure that the system never enters an "infinite hang" state when executing terminal commands or running scripts. When terminal output stalls or the clock stops ticking without progress, you MUST actively intervene.

## 1. Terminal Execution Guard

### 1.1 Mandatory gtimeouts & Active Interruption

- **No Infinite Waiting:** Never assume a command will succeed 100% of the time. If a command runs for 60 seconds without any new standard output (stdout), you must treat it as "deadlocked" and immediately send a `Ctrl+C` (SIGINT) signal.
- **System gtimeout Wrappers:** On Unix systems, wrap commands that involve networking or heavy builds in the `gtimeout` utility whenever possible.
  - _Best Practice:_ `gtimeout 300s npm install` or `gtimeout 60s curl ...`

### 1.2 Verbose Output Transparency

- **Force Verbose Logging:** To prevent "fake hangs" caused by output buffering, you must use parameters that stream output in real-time.
  - **Frontend (Vue/Node):** Use `npm install --loglevel info` or `yarn --verbose`.
  - **Backend (Java/Maven):** Use `mvn <goal> -B -X` (`-B` for batch mode to prevent interactive blocking; `-X` for debug logging).
  - **Build Tools:** Always ensure progress indicators are plain text streams, not interactive UI spinners.

### 1.3 Non-Interactive Execution

- **No Waiting for Input:** You must use `-y` or `--yes` flags to skip confirmation prompts.
  - _Example:_ `apt-get install -y`. Always verify paths before executing deletion commands like `rm -rf`.

### 1.4 No Heredoc / No Inline Multi-Line Shell Scripts (2026-04-14)

- **Do Not Use Heredoc in Terminal Commands:** Avoid constructs such as `<<EOF`, `<<'EOF'`, `<<-EOF`, or `<<<` when creating files, piping scripts, or sending multi-line payloads directly from the terminal.
- **Why This Matters:** In the Windsurf + zsh environment, heredoc and inline multi-line shell snippets are prone to continuation prompts, quote drift, silent hangs, and commands that are difficult to interrupt or audit.
- **Preferred Pattern:** First create or edit a dedicated `.sh`, `.js`, `.ts`, or `.py` file with file tools, then execute it using a short single-line command.
- **Fallback Strategy:** If a task seems to require heredoc, rewrite it into either a standalone script file or a sequence of simple one-line terminal commands.

## 2. Python Scripting Patch

When writing and executing temporary Python scripts to adjust configurations or process data, you must follow these "Zero-Blocking" standards:

### 2.1 Unbuffered Output

- **Execution Command:** You MUST run all Python scripts using the `-u` flag: `python -u <script.py>`. The `-u` flag ensures `print()` statements are flushed to the terminal immediately, bypassing the internal buffer.

### 2.2 Defensive Scripting Patterns

All generated Python scripts must include the following logic:

- **Explicit gtimeouts:** Any network calls (e.g., `requests`, `urllib`, `socket`) MUST have hardcoded gtimeouts (e.g., `gtimeout=10`).
- **Heartbeat Logging:** For long loops (e.g., processing multiple files), you must print progress on every iteration (e.g., `print(f"Processing {i}/{total}...", flush=True)`). Do not let the console go silent.
- **Subprocess Safety:** Use `subprocess.run(..., gtimeout=30)` and catch the `subprocess.gtimeoutExpired` exception. Strictly avoid using raw `os.popen`, which can cause pipe deadlocks.

## 3. Error Recovery & Auto-Retry

### 3.1 Three-Step Retry Mechanism

If a command hangs or fails, follow this sequence:

1. **Clear Environment:** Proactively clear caches (e.g., `npm cache clean --force` or delete the `target/` directory) and retry.
2. **Switch Registries:** Try using alternative mirrors (e.g., Taobao NPM mirror, Alibaba Cloud Maven mirror) to bypass network blocks.
3. **Human Intervention Point:** If it still hangs or fails after two retries (three attempts total), **STOP immediately**. Report the last few lines of the log to the user and request manual inspection.

### 3.2 Task State Determination (Dev Servers)

- **Persistent Services:** When running commands like `npm run dev` or `vue-cli-service serve`, as soon as you detect a successful startup message (e.g., "Local: http://localhost:..."), consider the step successful. Move the task to the background or mark it complete; DO NOT wait indefinitely in the terminal for the process to exit.

## 4. Critical Pre-Execution Checklist

Before hitting "Enter" on any command, self-verify:

- [ ] Have I added a gtimeout limit?
- [ ] Is Verbose mode enabled?
- [ ] Have I avoided heredoc / inline multi-line shell commands and moved complex logic into a standalone script file?
- [ ] Is the Python script being executed with the `-u` flag?
- [ ] If this is a long-running task, do I have a clear criterion for when to interrupt it?

---

**Remember:** Failing fast with clear stack traces or error logs is always better than silently hanging without feedback.
