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
  const controller = stubCoreControllableMatchMedia((query) => matchesFor(query, isDesktop));

  return {
    setDesktop(next: boolean) {
      controller.setMatches((query) => matchesFor(query, next));
    },
  };
}
