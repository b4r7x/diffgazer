import { Menu, type MenuItemProps, type MenuProps } from "@diffgazer/ui/components/menu";
import {
  NavigationList,
  type NavigationListItemProps,
  type NavigationListProps,
  type NavigationListTitleProps,
} from "@diffgazer/ui/components/navigation-list";
import { type CDPSession, expect, type Page, test } from "@playwright/test";
import { type ComponentType, createElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";

interface DomNodeReference {
  nodeId: number;
  backendDOMNodeId: number;
}

interface ActiveDescendantRelation {
  backendDOMNodeId: number;
  idref?: string;
}

function createRequiredChildrenElement<Props extends { children: ReactNode }>(
  component: ComponentType<Props>,
  props: Omit<Props, "children">,
  children: ReactNode,
): ReactElement {
  return createElement(component as ComponentType<Omit<Props, "children">>, props, children);
}

function navigationItem(id: string, label: string, disabled = false): ReactElement {
  return createRequiredChildrenElement<NavigationListItemProps>(
    NavigationList.Item,
    { id, disabled },
    createRequiredChildrenElement<NavigationListTitleProps>(NavigationList.Title, {}, label),
  );
}

function WrappedNavigationItem(): ReactElement {
  return navigationItem("wrapped", "Wrapped item");
}

async function setServerFixture(page: Page, element: ReactElement): Promise<void> {
  const markup = renderToString(element);
  await page.setContent(`<!doctype html><html lang="en"><body>${markup}</body></html>`);
  await expect(page.locator("script")).toHaveCount(0);
}

async function queryDomNode(client: CDPSession, selector: string): Promise<DomNodeReference> {
  const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  });
  expect(nodeId, `Expected DOM node for selector: ${selector}`).not.toBe(0);

  const { node } = await client.send("DOM.describeNode", { nodeId });
  return { nodeId, backendDOMNodeId: node.backendNodeId };
}

async function getActiveDescendantRelation(
  page: Page,
  ownerSelector: string,
): Promise<ActiveDescendantRelation | null> {
  const client = await page.context().newCDPSession(page);
  try {
    const owner = await queryDomNode(client, ownerSelector);
    const { nodes } = await client.send("Accessibility.getPartialAXTree", {
      nodeId: owner.nodeId,
      fetchRelatives: false,
    });
    const ownerAxNode = nodes.find((node) => node.backendDOMNodeId === owner.backendDOMNodeId);
    expect(ownerAxNode, `Expected AX node for selector: ${ownerSelector}`).toBeDefined();

    const relation = ownerAxNode?.properties?.find(
      (property) => property.name === "activedescendant",
    );
    const relatedNode = relation?.value?.relatedNodes?.[0];
    if (relatedNode?.backendDOMNodeId === undefined) return null;

    return {
      backendDOMNodeId: relatedNode.backendDOMNodeId,
      idref: relatedNode.idref,
    };
  } finally {
    await client.detach();
  }
}

async function getBackendDOMNodeId(page: Page, selector: string): Promise<number> {
  const client = await page.context().newCDPSession(page);
  try {
    return (await queryDomNode(client, selector)).backendDOMNodeId;
  } finally {
    await client.detach();
  }
}

test.describe("Server-rendered listbox active descendants", () => {
  test("relates a direct selected NavigationList option in Chromium AX", async ({ page }) => {
    await setServerFixture(
      page,
      createRequiredChildrenElement<NavigationListProps>(
        NavigationList,
        {
          "aria-label": "Selected reviews",
          id: "navigation-selected",
          defaultSelectedId: "selected",
        },
        navigationItem("selected", "Selected review"),
      ),
    );

    const ownerSelector = "#navigation-selected";
    const itemSelector = `${ownerSelector} [role="option"]`;
    const itemId = await page.locator(itemSelector).getAttribute("id");
    const relation = await getActiveDescendantRelation(page, ownerSelector);

    expect(itemId).not.toBeNull();
    expect(relation).toEqual({
      backendDOMNodeId: await getBackendDOMNodeId(page, itemSelector),
      idref: itemId ?? undefined,
    });
  });

  test("relates a direct highlighted Menu item in Chromium AX", async ({ page }) => {
    await setServerFixture(
      page,
      createRequiredChildrenElement<MenuProps>(
        Menu,
        {
          "aria-label": "Highlighted actions",
          id: "menu-highlighted",
          defaultHighlighted: "highlighted",
        },
        createRequiredChildrenElement<MenuItemProps>(
          Menu.Item,
          { id: "highlighted" },
          "Highlighted action",
        ),
      ),
    );

    const ownerSelector = "#menu-highlighted";
    const itemSelector = `${ownerSelector} [role="menuitem"]`;
    const itemId = await page.locator(itemSelector).getAttribute("id");
    const relation = await getActiveDescendantRelation(page, ownerSelector);

    expect(itemId).not.toBeNull();
    expect(relation).toEqual({
      backendDOMNodeId: await getBackendDOMNodeId(page, itemSelector),
      idref: itemId ?? undefined,
    });
  });

  test("does not relate a disabled selected NavigationList option", async ({ page }) => {
    await setServerFixture(
      page,
      createRequiredChildrenElement<NavigationListProps>(
        NavigationList,
        {
          "aria-label": "Disabled reviews",
          id: "navigation-disabled",
          defaultSelectedId: "disabled",
        },
        navigationItem("disabled", "Disabled review", true),
      ),
    );

    const ownerSelector = "#navigation-disabled";
    await expect(page.locator(`${ownerSelector} [role="option"]`)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(await getActiveDescendantRelation(page, ownerSelector)).toBeNull();
  });

  test("does not invent an active descendant for an opaque wrapper item", async ({ page }) => {
    await setServerFixture(
      page,
      createRequiredChildrenElement<NavigationListProps>(
        NavigationList,
        {
          "aria-label": "Wrapped reviews",
          id: "navigation-wrapped",
          defaultHighlighted: "wrapped",
        },
        createElement(WrappedNavigationItem),
      ),
    );

    const ownerSelector = "#navigation-wrapped";
    await expect(page.locator(`${ownerSelector} [role="option"]`)).toContainText("Wrapped item");
    expect(await getActiveDescendantRelation(page, ownerSelector)).toBeNull();
  });

  test("omits an active descendant when no Menu item is selected or highlighted", async ({
    page,
  }) => {
    await setServerFixture(
      page,
      createRequiredChildrenElement<MenuProps>(
        Menu,
        {
          "aria-label": "Idle actions",
          id: "menu-idle",
        },
        createRequiredChildrenElement<MenuItemProps>(Menu.Item, { id: "idle" }, "Idle action"),
      ),
    );

    const ownerSelector = "#menu-idle";
    await expect(page.locator(`${ownerSelector} [role="menuitem"]`)).toContainText("Idle action");
    expect(await getActiveDescendantRelation(page, ownerSelector)).toBeNull();
  });
});
