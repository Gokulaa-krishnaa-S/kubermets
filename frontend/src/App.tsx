import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Overview from "./pages/Overview";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import K8sDashboard from "./pages/K8newDashbaord";
import { AlertsAndCost } from "@/pages/AlertsAndCost";
import { BillingAndCost } from "./pages/BillingAndCost";
import KubernetesInstanceList from "./pages/kubernetesInstance";
import MetricRoutes from "./pages/MetricRoutes";

const queryClient = new QueryClient();

const handleDomainSelect = (hash: string) => {
    console.log("Selected Unique Hash:", hash);
    // setSelectedHash(hash);
    // refreshAllData(true);
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
    
      <BrowserRouter>
        <Routes>
          {/* Direct routes */}
          <Route path="/" element={<Overview />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/new" element={<K8sDashboard />} />
          <Route path="/alerts-events" element={<AlertsAndCost />} />
          <Route path="/billing-cost" element={<BillingAndCost />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/instance" element={<KubernetesInstanceList />} />
          
          {/* Nested metric routes */}
          <Route path="/metric/*" element={<MetricRoutes />} />
          
          {/* Catch-all route - MUST be last */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;