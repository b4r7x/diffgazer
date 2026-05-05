import { resolve } from "node:path";
import { copyGeneratedDir } from "@diffgazer/registry/cli";

const pkgRoot = resolve(import.meta.dirname, "..");
copyGeneratedDir(pkgRoot, "src/generated", "dist/generated");
