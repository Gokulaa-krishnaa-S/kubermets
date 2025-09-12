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
  useSearchParams,
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

// Cluster Creation Pages
import GCPClusterPage from "./pages/cluster-creation/GCPClusterPage";
import AWSClusterPage from "./pages/cluster-creation/AWSClusterPage";
import AzureClusterPage from "./pages/cluster-creation/AzureClusterPage";
import SifyClusterPage from "./pages/cluster-creation/SifyClusterPage";
import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { useCluster } from "./components/context/ClusterContext";

const queryClient = new QueryClient();

function MetricLayout() {
  const [selectedHash, setSelectedHash] = useState<string>("");
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { backendError } = useCluster();

  // Handle domain selection from Header - this will be shared across all metric pages
  const handleDomainSelect = (hash: string) => {
    console.log("Selected Hash in MetricRoutes:", hash);
    setSelectedHash(hash);
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("cluster_id", String(hash));
      return newParams;
    });
  };

  // Get current page info based on route
  const getPageInfo = () => {
    const path = location.pathname;
    if (path.includes("/cluster-creation")) {
      return {
        title: "Cluster Creation",
        subtitle: "Cluster Creation page",
      };
    }
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
    <Layout 
      title={title} 
      subtitle={subtitle}
      onDomainChange={handleDomainSelect}
    >
      {backendError ? (
        <div className="p-4 m-4 rounded border border-red-300 bg-red-50 text-red-700">
          Backend connection failed: {backendError}
        </div>
      ) : null}
      <Outlet context={{ selectedHash, onDomainSelect: handleDomainSelect }} />
    </Layout>
  );
}
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter basename="/environment">
        <ClusterProvider>
          <Routes>
            {/* Direct routes */}
            <Route path="/" element={<MetricLayout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/new" element={<K8sDashboard />} />
              <Route path="/alerts-events" element={<AlertsAndCost />} />
              <Route path="/billing-cost" element={<BillingAndCost />} />
              {/* <Route path="/settings" element={<Settings />} /> */}
              <Route path="/instance" element={<KubernetesInstanceList />} />

              {/* Nested metric routes */}
              <Route path="/metric/*" element={<MetricRoutes />} />

              {/* Cluster Creation routes */}
              <Route
                path="/cluster-creation/gcp"
                element={<GCPClusterPage />}
              />
              <Route
                path="/cluster-creation/aws"
                element={<AWSClusterPage />}
              />
              <Route
                path="/cluster-creation/azure"
                element={<AzureClusterPage />}
              />
              <Route
                path="/cluster-creation/sify"
                element={<SifyClusterPage />}
              />
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
