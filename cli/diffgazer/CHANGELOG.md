# diffgazer

## 0.1.4

### Patch Changes

- 6416350: Documentation and release-tooling release. Installing, launching, and reviewing
  behave exactly as in 0.1.3; the install and first-review guides were expanded and the
  published package surface is now validated before every release.

## 0.1.3

Reconstructed retroactively; this version predates the changeset-based flow.

- Fix embedded server issues affecting CLI startup.
- Fix onboarding settings refresh after configuration changes.
- Update README, logo, and demo assets.

## 0.1.2

Reconstructed retroactively; this version predates the changeset-based flow. It was
published to npm but never tagged in git; its changes are attributed from the
`v0.1.1..v0.1.3` range.

- Fix keyring credential handling.

## 0.1.1

Reconstructed retroactively; this version predates the changeset-based flow. Initial
official `diffgazer` release.

- Launch the Diffgazer environment from the CLI: in production, run the embedded server
  and serve the static web app; in development, spawn the API server and web frontend with
  HMR.
