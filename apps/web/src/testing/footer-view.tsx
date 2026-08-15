import { useFooterData } from "@diffgazer/core/footer";
import { Footer } from "@/components/layout/footer";

/** Renders the published footer so tests can assert a screen's shortcut legend. */
export function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}
