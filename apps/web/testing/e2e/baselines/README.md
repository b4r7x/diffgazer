# Results-layout visual baselines

Playwright stores a platform-specific PNG for the desktop and Pixel 7 projects. Generate the
macOS baselines locally with:

```bash
pnpm --filter @diffgazer/web exec playwright test --grep @parity --update-snapshots
```

Linux CI runs Playwright directly on an `ubuntu-latest` GitHub runner after the repository setup
action installs pnpm, Node 24, and frozen-lockfile dependencies. Regenerate and commit its matching
`*-linux.png` files on a Linux runner with:

```bash
pnpm --filter @diffgazer/web exec playwright install --with-deps chromium
pnpm --filter @diffgazer/core build
pnpm --filter @diffgazer/web exec playwright test --grep @parity --update-snapshots
```

For a reproducible local Linux run, the official Playwright image provides the browser and system
dependencies. The image tag is derived from the runner this workspace actually resolves, so a
version bump inside the declared range cannot leave the recipe on an image without that browser
build. This command exports the committed tree into an isolated container, installs Linux
dependencies there, and copies only the generated baselines back to the workspace:

```bash
playwright_version="$(pnpm --filter @diffgazer/web exec playwright --version | awk '{print $2}')"
docker run --rm --init --ipc=host \
  -v "$PWD:/src:ro" \
  -v "$PWD/apps/web/testing/e2e/baselines/review-parity.e2e.ts-snapshots:/out" \
  "mcr.microsoft.com/playwright:v${playwright_version}-noble" bash -lc '
    mkdir /work
    git -C /src archive HEAD | tar -x -C /work
    cd /work
    corepack enable
    corepack prepare pnpm@11.13.0 --activate
    pnpm install --frozen-lockfile
    pnpm --filter @diffgazer/core build
    pnpm --filter @diffgazer/web exec playwright test --grep @parity --update-snapshots
    cp apps/web/testing/e2e/baselines/review-parity.e2e.ts-snapshots/*-linux.png /out/
  '
```

The Docker path operates on `HEAD`, so commit or otherwise reproduce the intended source state
before using it. Do not rename macOS images to Linux names; the Linux browser must create them.

The screenshot assertion masks only the run identifier because it is dynamic in real reviews.
