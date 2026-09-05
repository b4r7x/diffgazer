import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import {
  parseRegistryProxyCidr,
  renderRegistryNginxConfig,
} from "./validate-registry-proxy-cidr.mjs";

const root = resolve(import.meta.dirname, "../..");
const registryConfig = readFileSync(join(root, "deploy/registry-nginx.conf"), "utf8");
const registryDockerfile = readFileSync(join(root, "deploy/registry.Dockerfile"), "utf8");
const deployWorkflow = readFileSync(join(root, ".github/workflows/deploy.yml"), "utf8");
const nginxImage = /^FROM\s+([^\s]+)\s+AS runtime/im.exec(registryDockerfile)?.[1];
const dockerReady = spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;

function runDocker(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(
      [`docker ${args.join(" ")}`, result.stderr?.trim(), result.error?.message]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout?.trim() ?? "";
}

function renderRegistryConfig(proxyIp) {
  const rendered = renderRegistryNginxConfig(`${proxyIp}/32`, registryConfig)
    .replace("rate=10r/s", "rate=1r/s")
    .replaceAll("limit_req zone=registry burst=100 nodelay;", "limit_req zone=registry nodelay;")
    .replace(
      "limit_req_zone $binary_remote_addr zone=registry:10m rate=1r/s;",
      "limit_req_zone $binary_remote_addr zone=registry:10m rate=1r/s;\nlimit_req_status 429;",
    );

  assert.match(rendered, new RegExp(`set_real_ip_from ${proxyIp}/32;`));
  assert.doesNotMatch(
    rendered,
    /set_real_ip_from (?:10\.0\.0\.0\/8|172\.16\.0\.0\/12|192\.168\.0\.0\/16);/,
  );
  assert.equal((rendered.match(/limit_req zone=registry nodelay;/g) ?? []).length, 2);
  return rendered;
}

test("the registry config trusts one explicit proxy peer, never a private supernet", () => {
  assert.match(registryConfig, /set_real_ip_from 127\.0\.0\.1\/32;/);
  assert.match(registryConfig, /real_ip_recursive off;/);
  assert.doesNotMatch(
    registryConfig,
    /set_real_ip_from (?:10\.0\.0\.0\/8|172\.16\.0\.0\/12|192\.168\.0\.0\/16);/,
  );
});

test("the registry image pins its nginx digest and validates the proxy CIDR it builds with", () => {
  assert.match(registryDockerfile, /ARG REGISTRY_TRAEFIK_PROXY_CIDR=127\.0\.0\.1\/32/);
  assert.match(
    registryDockerfile,
    /FROM nginx:1\.30\.4-alpine-slim@sha256:77da26c31397bf6694b4bf93275f5b40b0b120ba1b8f114264b603e592c561d6 AS runtime/,
  );
  assert.match(registryDockerfile, /validate-registry-proxy-cidr\.mjs/);
});

test("the deploy workflow passes the proxy CIDR variable into the image build and validates it", () => {
  assert.match(
    deployWorkflow,
    /REGISTRY_TRAEFIK_PROXY_CIDR: \$\{\{ vars\.REGISTRY_TRAEFIK_PROXY_CIDR \}\}/,
  );
  assert.match(
    deployWorkflow,
    /REGISTRY_TRAEFIK_PROXY_CIDR=\$\{\{ vars\.REGISTRY_TRAEFIK_PROXY_CIDR \}\}/,
  );
  assert.match(deployWorkflow, /node scripts\/monorepo\/validate-registry-proxy-cidr\.mjs/);
});

test("every CORS-enabled registry location answers the preflight it advertises", () => {
  // A location that returns Access-Control-Allow-Origin but denies OPTIONS makes
  // its own advertised policy unreachable for any non-simple cross-origin fetch.
  const corsBlocks = registryConfig
    .split(/^ {4}location /m)
    .slice(1)
    .filter((block) => block.includes('Access-Control-Allow-Origin "*"'));

  assert.ok(corsBlocks.some((block) => block.startsWith("^~ /schema/")));
  assert.ok(corsBlocks.some((block) => block.startsWith("~ ^/r/(ui|keys)/")));
  for (const block of corsBlocks) {
    assert.match(block, /if \(\$request_method = OPTIONS\) \{/);
    assert.match(block, /limit_except GET HEAD OPTIONS \{/);
    assert.match(block, /Access-Control-Allow-Methods "GET, HEAD, OPTIONS"/);
  }
});

test("the registry image cites a CI gate that still exists", () => {
  // Shipping committed public/r bytes instead of rebuilding them is justified by
  // one named CI gate, so a renamed step must not leave that reason dangling.
  const citedGate = /"([^"]+)"/.exec(
    registryDockerfile
      .split(/\r?\n/)
      .filter((line) => line.startsWith("#"))
      .map((line) => line.replace(/^#\s?/, ""))
      .join(" "),
  )?.[1];
  assert.ok(
    citedGate,
    "registry.Dockerfile must name the gate that byte-verifies its COPYed trees",
  );

  const ci = parse(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"));
  const stepNames = Object.values(ci.jobs).flatMap((job) =>
    (job.steps ?? []).map((step) => step.name),
  );
  assert.ok(stepNames.includes(citedGate), `${citedGate} is not a CI step`);
});

test("every shipped nginx config is parsed at image build time", () => {
  // Neither config is exercised before the container starts, so a syntax error
  // otherwise first surfaces as a crash loop after :prod has already moved.
  const landingDockerfile = readFileSync(join(root, "deploy/landing.Dockerfile"), "utf8");
  for (const dockerfile of [registryDockerfile, landingDockerfile]) {
    assert.match(dockerfile, /^RUN nginx -t$/m);
  }
});

test("the registry image copies the script it builds with", () => {
  // The registry image fails to build if this file moves.
  assert.match(registryDockerfile, /^COPY scripts\/\S+/m);
});

test("registry proxy configuration accepts only canonical exact peers", () => {
  for (const cidr of ["127.0.0.1/32", "172.30.0.2/32", "2001:db8::1/128", "::1/128"]) {
    assert.equal(parseRegistryProxyCidr(cidr).cidr, cidr);
  }

  for (const cidr of [
    "192.168.0.0/016",
    "192.168.0.1/16",
    "10.1.0.0/16",
    "192.168.0.1/032",
    "2001:db8:0:0:0:0:0:1/128",
    "0:0:0:0:0:0:0:1/128",
    "::ffff:c0a8:1/128",
    "::ffff:192.168.0.1/128",
    "2001:db8::1/0128",
  ]) {
    assert.throws(() => parseRegistryProxyCidr(cidr), cidr);
  }
});

function validateRequestStep(name) {
  const step = parse(deployWorkflow)?.jobs?.["validate-request"]?.steps?.find(
    (candidate) => candidate?.name === name,
  );
  assert.ok(step, `deploy.yml must keep the "${name}" step`);
  return step;
}

function runTraefikPeerStep(env) {
  return spawnSync(
    "bash",
    ["-c", validateRequestStep("Require registry Traefik peer configuration").run],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...env },
    },
  );
}

test("a registry rollback reports the peer baked into the promoted image", () => {
  const peerStep = validateRequestStep("Require registry Traefik peer configuration");
  assert.doesNotMatch(peerStep.if, /rollback/);
  assert.equal(peerStep.if, validateRequestStep("Checkout registry validation helper").if);

  const rollback = runTraefikPeerStep({ ROLLBACK: "true", REGISTRY_TRAEFIK_PROXY_CIDR: "" });
  assert.equal(rollback.status, 0, rollback.stderr);
  assert.match(rollback.stdout, /::warning::.*REGISTRY_TRAEFIK_PROXY_CIDR of that build/);
});

test("a fresh registry deploy still refuses anything but an exact Traefik peer", () => {
  const unset = runTraefikPeerStep({ ROLLBACK: "false", REGISTRY_TRAEFIK_PROXY_CIDR: "" });
  assert.notEqual(unset.status, 0);
  assert.match(unset.stdout, /::error::Set the REGISTRY_TRAEFIK_PROXY_CIDR/);

  const supernet = runTraefikPeerStep({
    ROLLBACK: "false",
    REGISTRY_TRAEFIK_PROXY_CIDR: "10.0.0.0/8",
  });
  assert.notEqual(supernet.status, 0);

  const exact = runTraefikPeerStep({
    ROLLBACK: "false",
    REGISTRY_TRAEFIK_PROXY_CIDR: "172.18.0.5/32",
  });
  assert.equal(exact.status, 0, exact.stderr);
});

test("deployment runbooks require one exact peer prefix", () => {
  const publicDeployment = readFileSync(join(root, "deploy/PUBLIC_DEPLOYMENT.md"), "utf8");
  const reverseProxy = readFileSync(join(root, "deploy/REVERSE_PROXY.md"), "utf8");
  for (const runbook of [publicDeployment, reverseProxy]) {
    assert.match(runbook, /unpadded `\/32` \(IPv4\) or `\/128` \(IPv6\)/);
    assert.doesNotMatch(runbook, /dedicated proxy subnet|`\/16`|`\/64`/);
  }
});

const proxyConfig = `events {}
http {
    map $http_x_test_client $forwarded_client {
        default $http_x_test_client;
        "" $remote_addr;
    }

    server {
        listen 8081;
        location / {
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $forwarded_client;
            proxy_pass http://registry:8080;
        }
    }
}
`;

function publishedPort(container, port) {
  const output = runDocker(["port", container, `${port}/tcp`]);
  const match = output.match(/:(\d+)\s*$/m);
  assert.ok(match, `Docker did not publish ${container}:${port}: ${output}`);
  return Number(match[1]);
}

async function requestStatus(port, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/r/ui/registry.json`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  return response.status;
}

async function waitForNginx(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/favicon.ico`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.status === 204) return;
    } catch {
      // The container can take a few hundred milliseconds to start listening.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`nginx did not become ready on port ${port}`);
}

test(
  "registry nginx ignores direct spoofed XFF while honoring the trusted proxy address",
  { skip: !dockerReady && process.env.CI !== "true" ? "Docker daemon unavailable" : false },
  async () => {
    assert.ok(dockerReady, "Docker daemon is required for the registry runtime test in CI");
    assert.ok(nginxImage, "registry Dockerfile must pin an nginx runtime image");

    const tempRoot = mkdtempSync(join(tmpdir(), "dg-registry-nginx-"));
    const network = `dg-registry-${process.pid}-${Date.now()}`;
    const registry = `${network}-registry`;
    const proxy = `${network}-proxy`;
    const registryDir = join(tempRoot, "html", "r", "ui");
    mkdirSync(registryDir, { recursive: true });
    writeFileSync(join(registryDir, "registry.json"), "{}\n");
    writeFileSync(join(tempRoot, "registry.conf"), renderRegistryConfig("172.30.0.2"));
    writeFileSync(join(tempRoot, "proxy.conf"), proxyConfig);

    try {
      runDocker(["network", "create", "--subnet", "172.30.0.0/24", network]);
      runDocker([
        "run",
        "-d",
        "--name",
        registry,
        "--network",
        network,
        "--ip",
        "172.30.0.3",
        // The proxy config upstreams to `registry`; the container itself carries
        // the run-unique name, so give it that alias on the test network.
        "--network-alias",
        "registry",
        "-p",
        "127.0.0.1::8080",
        "--mount",
        `type=bind,source=${join(tempRoot, "registry.conf")},target=/etc/nginx/conf.d/default.conf,readonly`,
        // The rendered config includes the headers snippet the image build
        // copies in; the bare base image has no such file and nginx refuses
        // to start without it.
        "--mount",
        `type=bind,source=${join(root, "deploy/nginx-security-headers.conf")},target=/etc/nginx/snippets/security-headers.conf,readonly`,
        "--mount",
        `type=bind,source=${join(tempRoot, "html")},target=/usr/share/nginx/html,readonly`,
        nginxImage,
      ]);
      const registryPort = publishedPort(registry, 8080);

      runDocker([
        "run",
        "-d",
        "--name",
        proxy,
        "--network",
        network,
        "--ip",
        "172.30.0.2",
        "-p",
        "127.0.0.1::8081",
        "--mount",
        `type=bind,source=${join(tempRoot, "proxy.conf")},target=/etc/nginx/nginx.conf,readonly`,
        nginxImage,
      ]);
      const proxyPort = publishedPort(proxy, 8081);
      await waitForNginx(registryPort);
      await waitForNginx(proxyPort);

      const directStatuses = [];
      for (const address of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
        directStatuses.push(await requestStatus(registryPort, { "X-Forwarded-For": address }));
      }
      assert.deepEqual(
        directStatuses,
        [200, 429, 429],
        "rotating XFF on the untrusted direct connection must not create limiter keys",
      );

      assert.equal(await requestStatus(proxyPort, { "X-Test-Client": "198.51.100.10" }), 200);
      assert.equal(
        await requestStatus(proxyPort, { "X-Test-Client": "198.51.100.10" }),
        429,
        "the trusted proxy's forwarded client address must be rate limited",
      );
      assert.equal(
        await requestStatus(proxyPort, { "X-Test-Client": "198.51.100.11" }),
        200,
        "a distinct client forwarded by the trusted proxy must receive its own budget",
      );
    } finally {
      runDocker(["rm", "-f", proxy], { allowFailure: true });
      runDocker(["rm", "-f", registry], { allowFailure: true });
      runDocker(["network", "rm", network], { allowFailure: true });
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);
