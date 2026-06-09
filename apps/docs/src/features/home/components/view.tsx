import { HomeSidebarHeader } from "@/components/layout/home-sidebar-header";
import { TuiTwoPane } from "@/components/layout/tui-two-pane";
import type { HomeLibrary } from "../data";
import { HomeSidebar } from "./home-sidebar";
import { ModulesIndexTable } from "./modules-index-table";
import { SysInfoPanel } from "./sys-info-panel";

export function HomeView({ libraries }: { libraries: HomeLibrary[] }) {
  return (
    <TuiTwoPane
      contentInPanel={false}
      sidebar={() => <HomeSidebar libraries={libraries} />}
      sidebarHeader={<HomeSidebarHeader />}
    >
      <main id="main-content" className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <SysInfoPanel />
        <ModulesIndexTable libraries={libraries} />
      </main>
    </TuiTwoPane>
  );
}
