  import { SidebarProvider } from "@/components/ui/sidebar";
  import { AppSidebar } from "./Sidebar";
  import { Header } from "./Header";
  import { ThemeProvider } from "next-themes";
  import { useState } from "react";

  interface LayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    showAddButton?: boolean;
    addButtonText?: string;
    onAddClick?: () => void;
    onDomainChange?: (hash: string) => void; // Add this optional prop for external handling
  }

  export function Layout({
    children,
    title,
    subtitle,
    showAddButton,
    addButtonText,
    onAddClick,
    onDomainChange, // Add this prop
  }: LayoutProps) {
    const [selectedDomain, setSelectedDomain] = useState<string>("");

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
            <AppSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* <Header
                title={title}
                subtitle={subtitle}
                showAddButton={showAddButton}
                addButtonText={addButtonText}
                onAddClick={onAddClick}
                onDomainSelect={handleDomainSelect}
              /> */}
              <main className="flex-1 overflow-y-auto">
                <div className="p-4 lg:p-6">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </ThemeProvider>
    );
  }