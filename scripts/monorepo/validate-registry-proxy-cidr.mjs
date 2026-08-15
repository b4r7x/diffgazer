import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseHextets(value) {
  if (value === "") return [];
  const groups = value.split(":");
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) {
    throw new Error("REGISTRY_TRAEFIK_PROXY_CIDR contains an invalid IPv6 group");
  }
  return groups.map((group) => Number.parseInt(group, 16));
}

function parseIPv6Groups(address) {
  const compressionIndex = address.indexOf("::");
  const hasCompression = compressionIndex !== -1;
  if (hasCompression && address.indexOf("::", compressionIndex + 2) !== -1) {
    return null;
  }

  const leftText = hasCompression ? address.slice(0, compressionIndex) : address;
  const rightText = hasCompression ? address.slice(compressionIndex + 2) : "";
  if (!hasCompression && (leftText.startsWith(":") || leftText.endsWith(":"))) {
    return null;
  }

  let left;
  let right;
  try {
    left = parseHextets(leftText);
    right = parseHextets(rightText);
  } catch {
    return null;
  }

  const explicitCount = left.length + right.length;
  if (hasCompression ? explicitCount >= 8 : explicitCount !== 8) return null;
  return hasCompression
    ? [...left, ...Array.from({ length: 8 - explicitCount }, () => 0), ...right]
    : left;
}

function canonicalizeIPv6(address) {
  const groups = parseIPv6Groups(address);
  if (groups === null) return null;

  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length; ) {
    if (groups[index] !== 0) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < groups.length && groups[index] === 0) index += 1;
    const length = index - start;
    if (length > bestLength) {
      bestStart = start;
      bestLength = length;
    }
  }

  const formatGroup = (group) => group.toString(16);
  const canonical =
    bestLength < 2
      ? groups.map(formatGroup).join(":")
      : (() => {
          const leftPart = groups.slice(0, bestStart).map(formatGroup).join(":");
          const rightPart = groups
            .slice(bestStart + bestLength)
            .map(formatGroup)
            .join(":");
          return [leftPart, "::", rightPart].join("");
        })();

  return { canonical, groups };
}

function isCanonicalIPv4(address) {
  const octets = address.split(".");
  return (
    octets.length === 4 &&
    octets.every((octet) => /^(?:0|[1-9][0-9]{0,2})$/.test(octet) && Number(octet) <= 255)
  );
}

export function parseRegistryProxyCidr(value) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error("REGISTRY_TRAEFIK_PROXY_CIDR must be an exact peer CIDR");
  }

  const separator = value.indexOf("/");
  if (separator <= 0 || separator !== value.lastIndexOf("/")) {
    throw new Error("REGISTRY_TRAEFIK_PROXY_CIDR must contain one address and prefix");
  }

  const address = value.slice(0, separator);
  const prefix = value.slice(separator + 1);
  if (prefix !== "32" && prefix !== "128") {
    throw new Error("REGISTRY_TRAEFIK_PROXY_CIDR must use an exact /32 or /128 prefix");
  }

  if (isCanonicalIPv4(address)) {
    if (prefix !== "32") {
      throw new Error("IPv4 REGISTRY_TRAEFIK_PROXY_CIDR must use /32");
    }
    if (address === "0.0.0.0") {
      throw new Error("REGISTRY_TRAEFIK_PROXY_CIDR cannot use the unspecified IPv4 address");
    }
    return { address, cidr: value, family: 4, prefix: 32 };
  }

  if (address.includes(".")) {
    throw new Error(
      address.includes(":")
        ? "REGISTRY_TRAEFIK_PROXY_CIDR cannot use an IPv4-mapped IPv6 alias"
        : "REGISTRY_TRAEFIK_PROXY_CIDR must use canonical IPv4 spelling",
    );
  }

  const parsedIPv6 = canonicalizeIPv6(address);
  if (parsedIPv6 === null || parsedIPv6.canonical !== address) {
    throw new Error("REGISTRY_TRAEFIK_PROXY_CIDR must use canonical IPv6 spelling");
  }
  if (prefix !== "128") {
    throw new Error("IPv6 REGISTRY_TRAEFIK_PROXY_CIDR must use /128");
  }
  if (address === "::") {
    throw new Error("REGISTRY_TRAEFIK_PROXY_CIDR cannot use the unspecified IPv6 address");
  }

  const groups = parsedIPv6.groups;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    throw new Error("REGISTRY_TRAEFIK_PROXY_CIDR cannot use an IPv4-mapped IPv6 alias");
  }

  return { address, cidr: value, family: 6, prefix: 128 };
}

export function renderRegistryNginxConfig(cidr, source) {
  const parsed = parseRegistryProxyCidr(cidr);
  const placeholder = "set_real_ip_from 127.0.0.1/32;";
  if (source.split(placeholder).length !== 2) {
    throw new Error("registry-nginx.conf must contain one fail-closed proxy placeholder");
  }
  return source.replace(placeholder, `set_real_ip_from ${parsed.cidr};`);
}

const isDirectRun =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const [cidr, sourcePath, outputPath] = process.argv.slice(2);
  if (!cidr) throw new Error("Usage: validate-registry-proxy-cidr.mjs <cidr> [source] [output]");
  parseRegistryProxyCidr(cidr);
  if (sourcePath || outputPath) {
    if (!sourcePath || !outputPath) {
      throw new Error("source and output must be provided together");
    }
    writeFileSync(outputPath, renderRegistryNginxConfig(cidr, readFileSync(sourcePath, "utf8")));
  }
  console.log(`OK: ${cidr} is an exact trusted proxy peer`);
}
