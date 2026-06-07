export function validateArtifactPackSurface(_root, library, packedFiles) {
  const leaked = packedFiles.filter((path) => path.startsWith("dist/artifacts/"));

  return leaked.length
    ? [
        `${library.packageName} npm pack must not ship dist/artifacts: ${leaked.slice(0, 5).join(", ")}${leaked.length > 5 ? `, ... (${leaked.length} total)` : ""}`,
      ]
    : [];
}
