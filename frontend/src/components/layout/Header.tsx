import { Bell, Plus, Search, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { useCallback, useState } from "react";
import DomainTypeAhead from "../reusable/domainTypeAhead";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showAddButton?: boolean;
  addButtonText?: string;
  onAddClick?: () => void;
  onDomainSelect?: (hash: string) => void; // Add this prop
}

export function Header({
  title,
  subtitle,
  showAddButton = false,
  addButtonText = "Add Item",
  onAddClick,
  onDomainSelect, // Add this prop
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [selectedHash, setSelectedHash] = useState<string>("");

  // Handle domain selection - pass to parent and update local state
  const handleDomainSelect = useCallback(
    (hash: string) => {
      console.log("Domain selected:", hash);
      setSelectedHash(hash);
      // Call the parent callback if provided
      if (onDomainSelect) {
        onDomainSelect(hash);
      }
    },
    [onDomainSelect]
  );

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <SidebarTrigger className="lg:hidden" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          {/* <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
            <span className="sr-only">Notifications</span>
          </Button> */}

          {/* <div className="flex items-center"> */}
            {/* <DomainDropdown onSelect={handleDomainSelect} /> */}
            <DomainTypeAhead onSelect={handleDomainSelect} />
          {/* </div> */}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}