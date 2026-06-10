import { SidebarNavHeader } from "@/components/layout/sidebar-nav-header";
import { TuiTwoPane } from "@/components/layout/tui-two-pane";
import type { HomeLibrary } from "../data";
import { HomeSidebar } from "./home-sidebar";
import { ModulesIndexTable } from "./modules-index-table";
import { SysInfoPanel } from "./sys-info-panel";

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
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto outline-hidden lg:overflow-hidden"
        >
          <SysInfoPanel />
          <ModulesIndexTable libraries={libraries} />
        </main>
      </TuiTwoPane>
    </>
  );
}
