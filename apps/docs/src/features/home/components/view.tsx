import { ScriptOnce } from "@tanstack/react-router";
import { SidebarNavHeader } from "@/components/layout/sidebar-nav-header";
import { TuiTwoPane } from "@/components/layout/tui-two-pane";
import { MAIN_SCROLL_INIT_SCRIPT } from "@/lib/main-scroll-bootstrap";
import { MAIN_SCROLL_RESTORATION_ID } from "@/lib/main-scroll-restoration";
import type { HomeLibrary } from "../data";
import { HeroPanel } from "./hero-panel";
import { SessionPanel } from "./session-panel";
import { HomeSidebar } from "./sidebar";

export function HomeView({ libraries }: { libraries: HomeLibrary[] }) {
  return (
    <>
      <h1 className="sr-only">Documentation</h1>
      <TuiTwoPane
        contentInPanel={false}
        sidebar={(closeSidebar) => <HomeSidebar libraries={libraries} onNavigate={closeSidebar} />}
        sidebarHeader={<SidebarNavHeader label="ROOT" />}
      >
        <main
          id="main-content"
          data-scroll-restoration-id={MAIN_SCROLL_RESTORATION_ID}
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto outline-hidden lg:overflow-hidden"
        >
          <div className="flex min-h-0 flex-col gap-3 lg:flex-1 lg:flex-row">
            <HeroPanel libraries={libraries} />
            <SessionPanel />
          </div>
          <ScriptOnce>{MAIN_SCROLL_INIT_SCRIPT}</ScriptOnce>
        </main>
      </TuiTwoPane>
    </>
  );
}
