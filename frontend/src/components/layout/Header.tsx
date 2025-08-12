import { Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { useCallback, useState } from "react";
import DomainTypeAhead from "../reusable/domainTypeAhead";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showAddButton?: boolean;
  addButtonText?: string;
  onAddClick?: () => void;
  onDomainSelect?: (hash: string) => void;
}

export function Header({
  title,
  subtitle,
  showAddButton = false,
  addButtonText = "Add Item",
  onAddClick,
  onDomainSelect,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [selectedHash, setSelectedHash] = useState<string>("");

  const handleDomainSelect = useCallback(
    (hash: string) => {
      console.log("Domain selected:", hash);
      setSelectedHash(hash);
      onDomainSelect?.(hash);
    },
    [onDomainSelect]
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2 sm:px-6">
        
        {/* Left Section */}
        <div className="flex items-center gap-3 min-w-0">
          <SidebarTrigger className="lg:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 flex-1 sm:flex-none justify-end min-w-0">
          {/* Domain Selector */}
          <div className="w-full sm:w-auto flex-1 sm:flex-none min-w-[160px]">
            <DomainTypeAhead onSelect={handleDomainSelect} />
          </div>

          {/* Theme Toggle */}
          {/* <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button> */}

          {/* Optional Add Button */}
          {showAddButton && (
            <Button onClick={onAddClick} size="sm" className="whitespace-nowrap">
              {addButtonText}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
