# Claude Code Profile Switcher

Switch between multiple Claude Code accounts in VS Code with one click.

If you use Claude Code with more than one account (e.g., work and personal), this extension lets you switch between them instantly — no manual symlink juggling, no terminal commands.

## What It Does

Claude Code stores its configuration in `~/.claude`. This extension manages that directory as a symlink, pointing it at different config directories (like `~/.claude-work` or `~/.claude-personal`) depending on which profile you select.

When you switch profiles, the extension:

1. Repoints the `~/.claude` symlink to the selected profile's config directory
2. Sets `CLAUDE_CONFIG_DIR` for VS Code's integrated terminal
3. Updates the window title to show which profile is active (e.g., `[Work]`)
4. Reloads the VS Code window to apply changes

## Installation

### From the VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X` on Mac, `Ctrl+Shift+X` on Windows/Linux)
3. Search for **"Claude Code Profile Switcher"**
4. Click **Install**

### From a .vsix file

If you have the `.vsix` file directly:

```bash
code --install-extension claude-code-profile-switcher-1.0.0.vsix
```

Or in VS Code: Extensions sidebar → `...` menu → **Install from VSIX...**

## Getting Started

### First-time setup (no existing profiles)

If you don't have Claude Code profiles set up yet:

1. After installing, you'll see a notification: **"No Claude profiles found. Set up multi-account switching?"**
2. Click **Get Started**
3. Enter a name for your first profile (e.g., "Work")
4. A terminal opens with `CLAUDE_CONFIG_DIR` pre-set — run `claude auth login` to authenticate
5. Click **Done** when authentication is complete
6. Choose whether to add another profile or finish setup
7. The extension creates shell aliases and activates your first profile

You can also trigger this manually: `Cmd+Shift+P` → **"Claude: Setup Profiles"**

### If you already have profiles set up

If you already have directories like `~/.claude-work` and `~/.claude-personal`:

1. The extension works out of the box with its default configuration
2. The status bar shows your active profile immediately
3. Click the status bar item or run `Cmd+Shift+P` → **"Claude: Switch Profile"** to switch

### Custom profile configuration

To add, remove, or rename profiles, open VS Code Settings (`Cmd+,`) and search for `claudeProfileSwitcher.profiles`. The setting is a JSON array:

```json
"claudeProfileSwitcher.profiles": [
  {
    "name": "Work",
    "configDir": "~/.claude-work"
  },
  {
    "name": "Personal",
    "configDir": "~/.claude-personal"
  },
  {
    "name": "Client Project",
    "configDir": "~/.claude-client"
  }
]
```

Each profile needs:
- **name**: Display name shown in the status bar and quick pick menu
- **configDir**: Path to the Claude config directory (supports `~` for home directory)

## Usage

### Switching profiles

- **Status bar**: Click the `Claude: <profile>` item in the bottom-left status bar
- **Command Palette**: `Cmd+Shift+P` → **"Claude: Switch Profile"**
- **Shell aliases** (if set up during onboarding): Run `claude-work` or `claude-personal` in any terminal

### Status bar indicator

| State | Display |
|-------|---------|
| Profile active | `$(account) Claude: Work` |
| No profile detected | `$(warning) Claude: Unknown` (yellow warning) |

### Shell aliases

During onboarding, the extension adds aliases to your `.zshrc` or `.bashrc`:

```bash
# === Claude Code Profile Switcher ===
alias claude-work="export CLAUDE_CONFIG_DIR=~/.claude-work; ln -sf ~/.claude-work ~/.claude"
alias claude-personal="export CLAUDE_CONFIG_DIR=~/.claude-personal; ln -sf ~/.claude-personal ~/.claude"
```

These let you switch profiles from any terminal, not just VS Code.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `claudeProfileSwitcher.profiles` | Work + Personal | Array of profile objects with `name` and `configDir` |
| `claudeProfileSwitcher.symlinkPath` | `~/.claude` | Path to the symlink that gets repointed on switch |

## Commands

| Command | Description |
|---------|-------------|
| **Claude: Switch Profile** | Open quick pick to select a profile |
| **Claude: Setup Profiles** | Run the guided onboarding wizard |

## How It Works

```
~/.claude → ~/.claude-work/      (symlink, managed by extension)
~/.claude-work/                  (real directory, Work account config)
~/.claude-personal/              (real directory, Personal account config)
```

When you switch to "Personal", the extension removes the `~/.claude` symlink and recreates it pointing to `~/.claude-personal`. New Claude Code sessions pick up the change automatically.

## Requirements

- VS Code 1.94.0 or later
- Claude Code CLI installed
- macOS, Linux, or WSL (symlink-based switching)

## Troubleshooting

**"Claude: Unknown" in status bar**
- The `~/.claude` symlink doesn't point to any configured profile directory. Run **Claude: Switch Profile** to fix it.

**Profile switch doesn't take effect**
- VS Code reloads after switching. If Claude Code was already running in a terminal, close that terminal and open a new one.

**Shell aliases not working**
- Run `source ~/.zshrc` (or `~/.bashrc`) after setup, or open a new terminal.

**Directory already exists during setup**
- The onboarding wizard won't overwrite existing directories. If `~/.claude-work` already exists, just add it to your profiles in Settings instead.

## License

MIT
