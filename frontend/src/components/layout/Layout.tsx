import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { CreateClusterModal } from "../cluster-creation/CreateClusterModal";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showAddButton?: boolean;
  addButtonText?: string;
  onAddClick?: () => void;
  onDomainChange?: (hash: string) => void;
}

export function Layout({
  children,
  title,
  subtitle,
  showAddButton,
  addButtonText,
  onAddClick,
  onDomainChange,
}: LayoutProps) {
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Handle domain selection from Header
  const handleDomainSelect = (hash: string) => {
    console.log("Domain selected in Layout:", hash);
    setSelectedDomain(hash);

    // Call external callback if provided
    if (onDomainChange) {
      onDomainChange(hash);
    }
  };

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar onCreateClusterClick={() => setIsCreateModalOpen(true)} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header
              title={title}
              subtitle={subtitle}
              showAddButton={showAddButton}
              addButtonText={addButtonText}
              onAddClick={onAddClick}
              onDomainSelect={handleDomainSelect}
            />
            <main className="flex-1 overflow-y-auto w-full">
              {children}
            </main>
            <CreateClusterModal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
            />
          </div>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}