import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Outlet,
} from "react-router-dom";
import Overview from "./pages/Overview";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import K8sDashboard from "./pages/K8newDashbaord";
import { AlertsAndCost } from "@/pages/AlertsAndCost";
import { BillingAndCost } from "./pages/BillingAndCost";
import KubernetesInstanceList from "./pages/kubernetesInstance";
import MetricRoutes from "./pages/MetricRoutes";
import { ClusterProvider } from "./components/context/ClusterContext";
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Header } from "@/components/layout/Header";
const queryClient = new QueryClient();

// const handleDomainSelect = (hash: string) => {
//   console.log("Selected Unique Hash:", hash);
//   // setSelectedHash(hash);
//   // refreshAllData(true);
// };

function MetricLayout() {
  const [selectedHash, setSelectedHash] = useState<string>("");
  const location = useLocation();

  // Handle domain selection from Header - this will be shared across all metric pages
  const handleDomainSelect = (hash: string) => {
    console.log("Selected Hash in MetricRoutes:", hash);
    setSelectedHash(hash);
  };

  // Get current page info based on route
  const getPageInfo = () => {
    const path = location.pathname;
    if (path.includes("/cluster")) {
      return {
        title: "Cluster Metrics",
        subtitle: "Node counts, status, and overall resource utilization",
      };
    } else if (path.includes("/nodes")) {
      return {
        title: "Node Metrics",
        subtitle: "CPU, memory, disk, network, and node health monitoring",
      };
    } else if (path.includes("/pods")) {
      return {
        title: "Pod Metrics",
        subtitle: "Pod and container resource usage and health",
      };
    } else if (path.includes("/")) {
      return {
        title: "Overview",
        subtitle:
          "Complete Kubernetes metrics visualization across multiple Clusters",
      };
    }
    return { title: "Metrics", subtitle: "" };
  };

  const { title, subtitle } = getPageInfo();

  return (
    <Layout title={title} subtitle={subtitle}>
      <Header
        title={title}
        subtitle={subtitle}
        onDomainSelect={handleDomainSelect}
      />
      <Outlet context={{ selectedHash, onDomainSelect: handleDomainSelect }} />
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <ClusterProvider>
          <Routes>
            <Route path="/" element={<MetricLayout />}>
              {/* Direct routes */}
              <Route path="/" element={<Overview />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/new" element={<K8sDashboard />} />
              <Route path="/alerts-events" element={<AlertsAndCost />} />
              <Route path="/billing-cost" element={<BillingAndCost />} />
              {/* <Route path="/settings" element={<Settings />} /> */}
              <Route path="/instance" element={<KubernetesInstanceList />} />

              {/* Nested metric routes */}
              <Route path="/metric/*" element={<MetricRoutes />} />
            </Route>

            {/* Catch-all route - MUST be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ClusterProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
