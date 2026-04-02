---
description: Build the VSIX package from scratch and optionally install it locally. No npm/npx required.
allowed-tools: [Bash, Read, Glob]
---

# Build VSIX

Build the `claude-code-profile-switcher` VSIX extension package from source. This manually constructs the VSIX (which is a zip file) without needing `@vscode/vsce` or npm.

## Instructions

1. Read `package.json` to get the current version, name, publisher, and description.

2. Create a temp build directory and copy extension files into it:

```
/tmp/vsix-build/
├── [Content_Types].xml
├── extension.vsixmanifest
└── extension/
    ├── package.json
    ├── README.md
    ├── icon.png
    └── src/
        └── extension.js
```

3. Generate `[Content_Types].xml` with these content types:
   - `.json` → `application/json`
   - `.js` → `application/javascript`
   - `.png` → `image/png`
   - `.md` → `text/markdown`
   - `.vsixmanifest` → `text/xml`

4. Generate `extension.vsixmanifest` using values from `package.json`:
   - `<Identity>`: Id from `name`, Version from `version`, Publisher from `publisher`
   - `<DisplayName>`: from `displayName`
   - `<Description>`: from `description`
   - `<Tags>`: from `keywords` joined by commas
   - `<Categories>`: from `categories`
   - `<GalleryFlags>Public</GalleryFlags>`
   - `<Property Id="Microsoft.VisualStudio.Code.Engine">`: from `engines.vscode`
   - `<Icon>extension/icon.png</Icon>`
   - Assets:
     - `Microsoft.VisualStudio.Code.Manifest` → `extension/package.json`
     - `Microsoft.VisualStudio.Services.Content.Details` → `extension/README.md`
     - `Microsoft.VisualStudio.Services.Icons.Default` → `extension/icon.png`

5. Zip the contents into `<name>-<version>.vsix` in the project root:
   ```bash
   cd /tmp/vsix-build && zip -r <project-root>/<name>-<version>.vsix .
   ```

6. Clean up the temp directory.

7. Report the output file path and size.

8. If $ARGUMENTS contains "install", also run:
   ```bash
   code --install-extension <output-vsix-path>
   ```
   and report whether installation succeeded.
