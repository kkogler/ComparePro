import { Sidebar } from "./Sidebar";
import { ProductionNavigation } from "./ProductionNavigation";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const currentPath = window.location.pathname;
  const isAdmin = currentPath.startsWith('/admin');
  const isOrg = currentPath.startsWith('/org/');
  const hasHeader = isAdmin || isOrg;

  return (
    <>
      <ProductionNavigation />
      <div className="flex h-screen overflow-hidden" style={{ paddingTop: hasHeader ? '60px' : '0' }}>
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </>
  );
}
