import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import ClusterMetrics from "./ClusterMetrics";
import NodeMetrics from "./NodeMetrics";
import PodMetrics from "./PodMetrics";
import { Layout } from "@/components/layout/Layout";
import { Header } from "@/components/layout/Header";

// Shared layout component for metric routes
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
    if (path.includes('/cluster')) {
      return {
        title: "Cluster Metrics",
        subtitle: "Node counts, status, and overall resource utilization"
      };
    } else if (path.includes('/nodes')) {
      return {
        title: "Node Metrics", 
        subtitle: "CPU, memory, disk, network, and node health monitoring"
      };
    } else if (path.includes('/pods')) {
      return {
        title: "Pod Metrics",
        subtitle: "Pod and container resource usage and health"
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
      <Outlet context={{ selectedHash }} />
    </Layout>
  );
}

export default function MetricRoutes() {
  return (
    <Routes>
      {/* Redirect /metric to /metric/cluster by default */}
      <Route path="/" element={<Navigate to="/metric/cluster" replace />} />
      
      {/* Shared layout for all metric routes */}
      <Route path="/" element={<MetricLayout />}>
        <Route path="/cluster" element={<ClusterMetrics />} />
        <Route path="/nodes" element={<NodeMetrics />} />
        <Route path="/pods" element={<PodMetrics />} />
      </Route>
    </Routes>
  );
}