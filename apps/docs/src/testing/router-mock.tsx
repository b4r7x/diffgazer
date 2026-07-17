import type { AnchorHTMLAttributes, ReactNode } from "react";

type LocationMock = {
  pathname: string;
};

type RouterStateMock = {
  location: LocationMock;
  status: "idle";
};

type RouterPathnameMockOptions = {
  pathname: string;
};

type RouterLinkMockProps = {
  to: string;
  params?: Record<string, string>;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

type UseLocationMock = {
  <Result>(args: { select: (location: LocationMock) => Result }): Result;
  (args?: { select?: undefined }): LocationMock;
};

type UseRouterStateMock = <Result>({
  select,
}: {
  select: (state: RouterStateMock) => Result;
}) => Result;

function resolveHref(to: string, params: Record<string, string> = {}) {
  let href = to;
  for (const [key, value] of Object.entries(params)) {
    if (key !== "_splat") {
      href = href.replace(`$${key}`, value);
    }
  }
  return params._splat ? href.replace("$", params._splat) : href.replace(/\/\$$/, "");
}

export function RouterLinkMock({ to, params, children, onClick, ...rest }: RouterLinkMockProps) {
  return (
    <a
      href={resolveHref(to, params)}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  );
}

export function useLocationMock(options: RouterPathnameMockOptions): {
  useLocation: UseLocationMock;
} {
  function useLocation<Result>({ select }: { select: (location: LocationMock) => Result }): Result;
  function useLocation(args?: { select?: undefined }): LocationMock;
  function useLocation<Result>(args: { select?: (location: LocationMock) => Result } = {}) {
    const location = { pathname: options.pathname };
    return args.select ? args.select(location) : location;
  }

  return { useLocation };
}

export function useRouterStateMock(options: RouterPathnameMockOptions): {
  useRouterState: UseRouterStateMock;
} {
  return {
    useRouterState: ({ select }) =>
      select({
        location: { pathname: options.pathname },
        status: "idle",
      }),
  };
}
