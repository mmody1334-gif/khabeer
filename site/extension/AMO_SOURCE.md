# Elkabsula — Nour Tool (Firefox) — Source Code Submission

This package contains the complete source code of the add-on
«خبير — أداة نور» (Khabeer — Nour Tool) and the exact steps to
reproduce the submitted `.xpi` / `.zip` package.

## What the add-on is

The tool is a hand-written userscript (`server/tahdir-noor.user.js`).
The Firefox add-on is a thin wrapper that runs the same userscript inside
the page with a small GreaseMonkey-compatible shim. **No part of the tool
logic is minified, transpiled, concatenated or obfuscated** — the only
processing applied by the build is plain-text substitution of three
placeholder strings inside a template file, plus verbatim file copying.

## Requirements

- **Python 3.8+** (Windows / Linux / macOS). Only the Python standard
  library is used — **no pip packages are required**.
- Pillow *(optional)*: if installed, icons are resized to 16/32/48/128 px;
  if missing, the 512 px icon is used for all sizes (the browser accepts it).
- **No Node.js / npm is needed.**

## Build steps

1. Run the build script from the repository root:

   ```
   python tools/build_ext.py
   ```

2. The script writes the extension files to `site/dist/ext/`:
   `main.js`, `bridge.js`, `background.js`, `manifest.json`,
   `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`.

3. Create the add-on package by zipping the **contents** of
   `site/dist/ext/` (files at the root of the archive).
   This reproduces exactly the submitted package
   `kabsula-firefox-unlisted-<version>.zip` (the same files are also
   produced automatically as `site/dist/store/kabsula-firefox-unlisted-<version>.zip`).

4. The add-on version equals the `@version` value in the header of
   `server/tahdir-noor.user.js` (currently **3.4.9**).

## File map

| File | Role |
|---|---|
| `server/tahdir-noor.user.js` | The actual tool code — single source of truth, hand-written (67 KB). |
| `extension/shim.js` | GM-API compatibility layer. Template containing the placeholders `__RUN__`, `__EXTVER__`, `__EXTSRC__` that the build replaces. |
| `extension/bridge.js` | Hand-written glue: passes the lesson data from the platform page (isolated world) to the MAIN world shim. |
| `extension/background.js` | Hand-written service worker: re-opens/reloads the platform tab after installation. |
| `server/icons.json` | Icon PNG (data URIs) used by the build to generate the icon files. |
| `tools/build_ext.py` | The build script. For Firefox it also writes `browser_specific_settings` (gecko id `noor-tool-unlisted@elkabsula.site`, `data_collection_permissions: none`, `strict_min_version` 140.0 / Android 142.0) and converts the background to event-page style. |

## Notes for reviewers

- The same sources build the Chrome Web Store / Edge Add-ons / Firefox
  listed variants (identical tool code, only manifest metadata differs).
- The tool only touches two sites: **khabeer.khabeer-bio.workers.dev** (teacher logs in
  first) and **lms.moe.gov.om** (Ministry of Education LMS, teacher
  login required). It fills web forms with lesson text the teacher
  explicitly sends from the Elkabsula platform and **never clicks Save**.
- It collects no data and contacts no server.
