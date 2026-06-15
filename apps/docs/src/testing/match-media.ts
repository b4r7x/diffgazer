import {
  stubControllableMatchMedia as stubCoreControllableMatchMedia,
  stubMatchMedia as stubCoreMatchMedia,
} from "@diffgazer/core/testing/match-media";

interface StubMatchMediaOptions {
  isDesktop: boolean;
}

function matchesFor(query: string, isDesktop: boolean) {
  if (query.includes("max-width")) {
    return !isDesktop;
  }
  if (query.includes("min-width")) {
    return isDesktop;
  }
  return false;
}

export function stubMatchMedia({ isDesktop }: StubMatchMediaOptions) {
  stubCoreMatchMedia((query) => matchesFor(query, isDesktop));
}

export function stubControllableMatchMedia({ isDesktop }: StubMatchMediaOptions) {
  let desktop = isDesktop;
  const controller = stubCoreControllableMatchMedia((query) => matchesFor(query, desktop));

  return {
    setDesktop(next: boolean) {
      desktop = next;
      controller.setMatches((query) => matchesFor(query, desktop));
    },
  };
}
