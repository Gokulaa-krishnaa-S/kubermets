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
  Navigate,
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
import { AuthRedirectWrapper } from "./authredirect";

const queryClient = new QueryClient();

function MetricLayout() {
  const [selectedHash, setSelectedHash] = useState<string>("");
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { backendError } = useCluster();


  const handleDomainSelect = (hash: string) => {
    console.log("Selected Hash in MetricRoutes:", hash);
    setSelectedHash(hash);
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("cluster_id", String(hash));
      return newParams;
    });
  };


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
    } else if (path.includes("/overview") || path === "/environment" || path === "/environment/") {
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
      {backendError && !backendError.includes("No authentication token") ? (
        <div className="p-4 m-4 rounded border border-red-300 bg-red-50 text-red-700">
          Backend connection failed: {backendError}
        </div>
      ) : null}
      <Outlet context={{ selectedHash, onDomainSelect: handleDomainSelect }} />
    </Layout>
  );
}


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { userId, loading, backendError } = useCluster();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }


  if (backendError && backendError.includes("No authentication token")) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-semibold mb-2">Authentication Required</h2>
          <p className="text-red-600 mb-4">{backendError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry Login
          </button>
        </div>
      </div>
    );
  }


  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter basename="/environment-ingress">
        <ClusterProvider>
          <Routes>

            <Route path="/" element={<Navigate to="/overview" replace />} />

            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Routes>
                    <Route element={<MetricLayout />}>
                      <Route path="/overview" element={<Overview />} />
                      <Route path="/new" element={<K8sDashboard />} />
                      <Route path="/alerts-events" element={<AlertsAndCost />} />
                      <Route path="/billing-cost" element={<BillingAndCost />} />
                      <Route path="/instance" element={<KubernetesInstanceList />} />


                      <Route path="/metric/*" element={<MetricRoutes />} />


                      <Route path="/cluster-creation/gcp" element={<GCPClusterPage />} />
                      <Route path="/cluster-creation/aws" element={<AWSClusterPage />} />
                      <Route path="/cluster-creation/azure" element={<AzureClusterPage />} />
                      <Route path="/cluster-creation/sify" element={<SifyClusterPage />} />

                      {/* Catch-all for unknown routes */}
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Routes>
                </ProtectedRoute>
              }
            />
          </Routes>
        </ClusterProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;