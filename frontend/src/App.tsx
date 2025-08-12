import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Overview from "./pages/Overview";
import ClusterMetrics from "./pages/ClusterMetrics";
import NodeMetrics from "./pages/NodeMetrics";
import PodMetrics from "./pages/PodMetrics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import K8sDashboard from "./pages/K8newDashbaord";
import { AlertsAndCost } from "@/pages/AlertsAndCost";
import { BillingAndCost } from "./pages/BillingAndCost";
import KubernetesInstanceList from "./pages/kubernetesInstance";
import { Layout } from "./components/layout/Layout";
import { Header } from "./components/layout/Header";

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
     {/* <Header
              title={title}
              subtitle={subtitle}
              showAddButton={showAddButton}
              addButtonText={addButtonText}
              onAddClick={onAddClick}
              onDomainSelect={handleDomainSelect} // Pass the callback
            /> */}
      <BrowserRouter>
        <Routes>
           {/* <Layout
      title="Node Metrics"
      subtitle="CPU, memory, disk, network, and node health monitoring"
      onDomainChange={handleDomainSelect}> */}
      
          <Route path="/new" element={<K8sDashboard />} />
          <Route path="/" element={<Overview />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/cluster" element={<ClusterMetrics />} />
          <Route path="/nodes" element={<NodeMetrics />} />
          <Route path="/pods" element={<PodMetrics />} />
          <Route path="/alerts-events" element={<AlertsAndCost />} />
          <Route path="/billing-cost" element={<BillingAndCost />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/instance" element={<KubernetesInstanceList />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          {/* </Layout> */}
        </Routes>
      </BrowserRouter>
      
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
