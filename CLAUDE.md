# CLAUDE.md

## Project Overview

**Claude Code Profile Switcher** — a VS Code extension that switches between multiple Claude Code configuration profiles via symlink management.

- **Extension ID**: `claude-code-profile-switcher`
- **Publisher**: `sairambkrishnan`
- **Source**: `src/extension.js` (single file, plain JS, no build step)
- **Package**: `package.json` (VS Code extension manifest)

## Architecture

- Profiles are stored in VS Code settings (`claudeProfileSwitcher.profiles`)
- Switching works by repointing the `~/.claude` symlink to the selected profile's config directory (e.g., `~/.claude-work`)
- Status bar shows active profile; window title prefixed with `[ProfileName]`
- Shell alias marker in RC files: `# === Claude Code Profile Switcher ===`

## Building the VSIX

npm/npx may be blocked on corporate networks. The VSIX is just a zip file with a specific structure. To build manually:

```
mkdir -p /tmp/vsix-build/extension/src
cp package.json README.md icon.png /tmp/vsix-build/extension/
cp src/extension.js /tmp/vsix-build/extension/src/
# Create [Content_Types].xml and extension.vsixmanifest (see build history)
cd /tmp/vsix-build && zip -r output.vsix .
```

Key files inside a VSIX:
- `[Content_Types].xml` — MIME type declarations
- `extension.vsixmanifest` — metadata, assets, installation targets
- `extension/` — the actual extension files

If `npx @vscode/vsce package` works, use that instead. But always have the manual zip approach as a fallback.

## Publishing to VS Code Marketplace

### What you actually need
1. A Microsoft account
2. A publisher created at https://marketplace.visualstudio.com/manage/createpublisher
3. Upload the VSIX directly from the publisher dashboard

### What you DO NOT need
- An Azure subscription
- An Azure DevOps organization
- A Personal Access Token (PAT)

### How to publish
1. Go to https://marketplace.visualstudio.com/manage
2. Click "+ New extension" → "Visual Studio Code"
3. Upload the `.vsix` file
4. Done

### Publisher creation form
- **Publisher ID**: required (must match `publisher` field in `package.json`)
- **Publisher Name**: required (display name)
- **Logo, description, website**: all optional — skip them

### Common traps to avoid
- **portal.azure.com** is the Azure cloud portal — wrong site entirely
- **dev.azure.com** is Azure DevOps — you do NOT need this for manual VSIX upload
- Azure DevOps org creation demands a subscription — irrelevant for Marketplace publishing via manual upload
- PATs are only needed for CLI publishing (`vsce publish`), not for manual upload through the web UI
- The "Sign in" button on azure.microsoft.com/en-us/products/devops redirects to portal.azure.com — useless loop

### If you want CLI publishing later
Only then do you need a PAT from dev.azure.com. But manual upload works fine and avoids the entire Azure DevOps nightmare.

## Extension Icon
- `icon.png` at project root, referenced in `package.json` as `"icon": "icon.png"`
- Must be PNG, 128x128 minimum (current: 1024x1024)
- Referenced in `extension.vsixmanifest` as both `Microsoft.VisualStudio.Services.Icons.Default` and in the `<Icon>` metadata tag

## README.md
- Doubles as the Marketplace listing page
- Must be included in the VSIX under `extension/README.md`
- Referenced in `extension.vsixmanifest` as `Microsoft.VisualStudio.Services.Content.Details`

## Testing
- Never modify `~/.claude-work` or `~/.claude-personal`
- Use throwaway dirs (`~/.claude-test`) for testing, clean up after
- Back up `~/.claude` symlink before any end-to-end tests
