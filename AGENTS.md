# Development and releases

Use the existing checkout. Each cloud task is isolated; do not create worktrees unless requested.
Read START_HERE.md and docs/DEVELOPMENT.md for the supported browser workflow.
Node >=22.13, npm ci, npm run dev. Run npm run check for code changes and relevant Playwright tests for UI flows. In this cloud environment use PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium for Playwright.

Preserve user data, existing SQL migrations, app identifier com.teacherworkspace.desktop and the updater public key. Never commit private signing keys, passwords, real API keys, or user databases. Do not read or print private key contents. Signing keys are not application source and must be backed up securely outside Git.

The stable updater channel is the public GitHub Releases of nvghy19112002-cmd/TeacherWorkspace-V1.10.7-source. See docs/AUTO_RELEASE.md. Version 1.10.8 starts a new signing channel; older installed apps require one manual installation. Do not promise old-key/old-endpoint clients can discover or verify this channel.

For each approved release, synchronize versions using npm run release:version -- x.y.z, update release notes, run checks, then commit/push and tag vx.y.z when publication is authorized. GitHub Actions builds/tests Windows, signs the installer, verifies downloaded release artifacts, and publishes only after those steps succeed. Never overwrite a published version or bypass failed checks/signature verification. Native Windows validation requires a Windows runner; browser checks do not establish it.

Playwright writes three tracked screenshots under docs/screenshots: calendar-dark.png, calendar-light.png, export-a4-print.png. Back up existing bytes before E2E and restore them afterward unless intentionally reviewing screenshot changes. Preserve pre-existing user edits.
