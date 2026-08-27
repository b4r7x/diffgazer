import { existsInRoot, invariantResult, readTextInRoot } from "./context.mjs";

export const LICENSE_MARKERS = {
  MIT: "MIT License",
  "Apache-2.0": "Apache License",
};

export const MIT_CANONICAL_MARKERS = [
  "Permission is hereby granted, free of charge",
  "copies or substantial portions of the Software",
  'THE SOFTWARE IS PROVIDED "AS IS"',
  "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE",
];

export const CANONICAL_MIT_LICENSE = `MIT License

Copyright (c) 2026 diffgazer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

export const APACHE_CANONICAL_MARKERS = [
  "(an example is provided in the Appendix below)",
  "link (or bind by name)",
  "(except as stated in this section) patent license",
  "cross-claim or counterclaim in a lawsuit",
  "(and each Contributor provides its Contributions)",
];

function collapseLicenseWhitespace(text) {
  return text.replace(/\s+/g, " ");
}

function licenseContainsMarker(licenseText, marker) {
  return collapseLicenseWhitespace(licenseText).includes(collapseLicenseWhitespace(marker));
}

export function checkLicenseFilesMatch(context) {
  const mismatches = [];

  for (const [file, parsed] of context.parsedPackages) {
    const licenseField = parsed.license;
    if (!licenseField) continue;

    const licensePath = file.replace(/package\.json$/, "LICENSE");
    if (!existsInRoot(context, licensePath)) {
      mismatches.push(`${file}: declared license "${licenseField}" but ${licensePath} is missing`);
      continue;
    }

    const marker = LICENSE_MARKERS[licenseField];
    if (!marker) {
      mismatches.push(
        `${file}: unknown license "${licenseField}" (expected one of ${Object.keys(LICENSE_MARKERS).join(", ")})`,
      );
      continue;
    }

    const licenseText = readTextInRoot(context, licensePath);
    if (!licenseText.includes(marker)) {
      mismatches.push(`${file}: license "${licenseField}" does not match ${licensePath}`);
      continue;
    }

    if (licenseField === "MIT") {
      const missingMarkers = MIT_CANONICAL_MARKERS.filter(
        (canonicalMarker) => !licenseContainsMarker(licenseText, canonicalMarker),
      );
      if (missingMarkers.length > 0) {
        mismatches.push(
          `${file}: ${licensePath} is not canonical MIT (missing ${missingMarkers.join(", ")})`,
        );
      }
    }

    if (licenseField === "Apache-2.0") {
      const missingMarkers = APACHE_CANONICAL_MARKERS.filter(
        (canonicalMarker) => !licenseContainsMarker(licenseText, canonicalMarker),
      );
      if (missingMarkers.length > 0) {
        mismatches.push(
          `${file}: ${licensePath} is not canonical Apache-2.0 (missing ${missingMarkers.join(", ")})`,
        );
      }
    }
  }

  return invariantResult(
    "package license fields match LICENSE files",
    mismatches.length === 0,
    mismatches.slice(0, 10).join("; "),
  );
}
