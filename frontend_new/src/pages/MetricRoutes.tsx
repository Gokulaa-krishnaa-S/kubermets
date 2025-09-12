import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import ClusterMetrics from "./ClusterMetrics";
import NodeMetrics from "./NodeMetrics";
import PodMetrics from "./PodMetrics";

export default function MetricRoutes() {
  return (
    <Routes>
      {/* Redirect /metric to /metric/cluster by default */}
      <Route path="/" element={<Navigate to="/metric/cluster" replace />} />

      {/* Shared layout for all metric routes */}

      <Route path="/cluster" element={<ClusterMetrics />} />
      <Route path="/nodes" element={<NodeMetrics />} />
      <Route path="/pods" element={<PodMetrics />} />
    </Routes>
  );
}
