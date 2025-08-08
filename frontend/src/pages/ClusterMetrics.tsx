import { useEffect, useState, useRef } from "react";
import ClusterService from "../services/ClusterService";
import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import { GroupedBarChart } from "@/components/chart/GroupedBarChart";
import { DonutChart } from "@/components/chart/DonutChart";
import { toast } from "@/components/ui/use-toast";
import { FilterBar } from "@/components/reusable/filterbar";
import ClusterDetailModal from "@/components/modals/ClusterDetailModal";

import { Server, Cpu, HardDrive, Activity } from "lucide-react";

export default function ClusterMetrics() {
  const [clusterStats, setClusterStats] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [chartData, setChartData] = useState({
    cpuData: [],
    memoryData: [],
    costBreakdown: [],
  });
  const [timeRange, setTimeRange] = useState("24h");
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const intervalRef = useRef(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [showClusterModal, setShowClusterModal] = useState(false);

  const [chartParams, setChartParams] = useState({
    window: "24h",
    aggregate: "cluster",
    accumulate: true,
    external: false,
    shareCost: 0,
    shareTenancyCosts: true,
    idle: true,
    shareIdle: false,
    idleByNode: false,
    shareLabels: "",
    shareNamespaces: "",
    shareSplit: "weighted",
    filter: "",
    chartType: "costovertime",
    costUnit: "cumulative",
    includeSharedCostBreakdown: true,
    offset: 0,
    limit: 25,
  });

  // Helper function to convert bytes to GB
  const bytesToGB = (bytes) => (bytes / 1024 ** 3).toFixed(2);

  // Function to refresh all data
  const refreshAllData = async (showToast = true) => {
    setIsRefreshing(true);
    try {
      const queryParams = {
        window: timeRange,
        aggregate: "cluster",
        accumulate: true,
        external: false,
        shareCost: 0,
        shareTenancyCosts: true,
        idle: true,
        shareIdle: true,
        idleByNode: true,
        shareLabels: "",
        shareNamespaces: "",
        shareSplit: "weighted",
        filter: "",
        force_refresh: true,
      };

      // Call both APIs concurrently
      await Promise.all([
        handleCallClusterData(queryParams),
        handleClusterChartData({ ...chartParams, window: timeRange }),
      ]);

      // Update last updated timestamp
      setLastUpdated(new Date());

      // Show success toast notification
      if (showToast) {
        toast({
          title: "Data Refreshed",
          description: "Cluster metrics have been updated successfully.",
          variant: "default",
        });
      }
    } catch (error) {
      console.log("Error refreshing data:", error);

      // Show error toast notification
      if (showToast) {
        toast({
          title: "Refresh Failed",
          description: "Failed to update cluster metrics. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const rangeFromUrl = searchParams.get("window") || "24h";
    setTimeRange(rangeFromUrl);

    const queryParams = {
      window: rangeFromUrl,
      aggregate: "cluster",
      accumulate: true,
      external: false,
      shareCost: 0,
      shareTenancyCosts: true,
      idle: true,
      shareIdle: true,
      idleByNode: true,
      shareLabels: "",
      shareNamespaces: "",
      shareSplit: "weighted",
      filter: "",
    };

    handleCallClusterData(queryParams);
    handleClusterChartData({ ...chartParams, window: rangeFromUrl });

    // Set initial last updated timestamp
    setLastUpdated(new Date());
  }, []);

  const handleCallClusterData = async (queryParams) => {
    ClusterService.getClusterAllocationSummary(queryParams)
      .then((res) => {
        const allocations: any = res?.data?.data?.sets?.[0]?.allocations || {};

        // Filter out idle data for cluster list
        const activeAllocations: any = Object.entries(allocations).filter(
          ([name]) => name !== "__idle__"
        );

        const clusterList = activeAllocations.map(([name, cluster]) => ({
          name,
          cpu: `${(
            (cluster.cpuCoreUsageAverage / cluster.cpuCoreRequestAverage) *
              100 || 0
          ).toFixed(0)}%`,
          memory: `${(
            (cluster.ramByteUsageAverage / cluster.ramByteRequestAverage) *
              100 || 0
          ).toFixed(0)}%`,
          cost: `$${cluster.totalCost.toFixed(2)}`,
          version: cluster.version ?? "N/A",
          nodes: 0,
          pods: 0,
          status: cluster.status ?? "running",
        }));

        // Calculate totals including idle
        const totalCpuCost: any = Object.values(allocations).reduce(
          (sum, c: any) => sum + c.cpuCost,
          0
        );
        const totalRamCost: any = Object.values(allocations).reduce(
          (sum, c: any) => sum + c.ramCost,
          0
        );
        const totalStorage: any = Object.values(allocations).reduce(
          (sum, c: any) => sum + c.pvCost,
          0
        );

        setClusters(clusterList);
        setClusterStats([
          {
            title: "Total Clusters",
            value: activeAllocations.length,
            subtitle: "Across all environments",
            icon: <Server className="w-4 h-4" />,
            trend: { value: "", direction: "up", label: "" },
            status: "healthy",
          },
          {
            title: "CPU Cost",
            value: `$${totalCpuCost.toFixed(2)}`,
            subtitle: "This period",
            icon: <Cpu className="w-4 h-4" />,
            trend: { value: "", direction: "up", label: "" },
            status: "info",
          },
          {
            title: "Memory Cost",
            value: `$${totalRamCost.toFixed(2)}`,
            subtitle: "This period",
            icon: <Activity className="w-4 h-4" />,
            trend: { value: "", direction: "up", label: "" },
            status: "healthy",
          },
          {
            title: "Storage Cost",
            value: `$${totalStorage.toFixed(2)}`,
            subtitle: "This period",
            icon: <HardDrive className="w-4 h-4" />,
            trend: { value: "", direction: "up", label: "" },
            status: "info",
          },
        ]);
      })
      .catch(() => console.log("Failed to fetch cluster summary"));
  };

  const handleClusterChartData = async (queryParams) => {
    ClusterService.getClusterAllocationSummary(queryParams)
      .then((res: any) => {
        const allocations: any = res?.data?.data?.sets?.[0]?.allocations || {};

        // Prepare CPU usage data for grouped bar chart
        const cpuChartData: any = Object.entries(allocations)
          .filter(([name]) => name !== "__idle__")
          .map(([name, cluster]) => {
            const c = cluster as {
              cpuCoreUsageAverage: number;
              cpuCoreRequestAverage: number;
            };

            return {
              name,
              used: parseFloat(c.cpuCoreUsageAverage.toFixed(2)),
              requested: parseFloat(c.cpuCoreRequestAverage.toFixed(2)),
            };
          });

        // Prepare Memory usage data for grouped bar chart
        const memoryChartData = Object.entries(allocations)
          .filter(([name]) => name !== "__idle__")
          .map(([name, cluster]) => {
            const c = cluster as {
              ramByteUsageAverage: number;
              ramByteRequestAverage: number;
            };

            return {
              name,
              used: parseFloat(bytesToGB(c.ramByteUsageAverage)),
              requested: parseFloat(bytesToGB(c.ramByteRequestAverage)),
            };
          });

        // Prepare cost breakdown for donut chart
        type Allocation = {
          totalCost: number;
        };

        const costData = Object.entries(allocations).map(([name, cluster]) => {
          const c = cluster as Allocation;

          const totalClusterCost: any = Object.values(allocations).reduce(
            (sum, item) => {
              const a = item as any;
              return sum + a.totalCost;
            },
            0
          );

          return {
            name: name === "__idle__" ? "Idle Resources" : name,
            value: parseFloat(c.totalCost.toFixed(2)),
            label: "Cost ($)",
            percentage: ((c.totalCost / totalClusterCost) * 100).toFixed(1),
          };
        });

        setChartData({
          cpuData: cpuChartData,
          memoryData: memoryChartData,
          costBreakdown: costData,
        });
      })
      .catch(() => console.log("Failed to fetch cluster chart data"));
  };

  const handleTimeRangeChange = (range) => {
    try {
      const queryParams = {
        window: range,
        aggregate: "cluster",
        accumulate: true,
        external: false,
        shareCost: 0,
        shareTenancyCosts: true,
        idle: true,
        shareIdle: true,
        idleByNode: true,
        shareLabels: "",
        shareNamespaces: "",
        shareSplit: "weighted",
        filter: "",
      };

      const updatedChartParams = { ...chartParams, window: range };
      setChartParams(updatedChartParams);
      handleClusterChartData(updatedChartParams);

      setTimeRange(range);
      setSearchParams({ window: range });
      handleCallClusterData(queryParams);
    } catch (error) {
      console.log(error);
    }
  };

  const handleRefreshIntervalChange = (interval) => {
    setRefreshInterval(interval);
  };

  const handleFilterClick = () => {
    // Implement filter functionality here
    console.log("Filter button clicked");
  };

  return (
    <Layout
      title="Cluster Metrics"
      subtitle="Node counts, status, and overall resource utilization"
    >
      {/* Filter Bar */}
      <FilterBar
        selectedTimeRange={timeRange}
        onTimeRangeChange={handleTimeRangeChange}
        timeRangeVariant="select" // ✅
        timeRangeOptions={["1h", "6h", "24h", "7d", "30d"]}
        onFilterClick={handleFilterClick}
        showFilter={false}
        onRefresh={refreshAllData}
        refreshInterval={refreshInterval}
        onRefreshIntervalChange={handleRefreshIntervalChange}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        showRefresh={true}
        className="mb-6"
      />

      <div className="space-y-6">
        {/* Dynamic Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {clusterStats.map((stat, index) => (
            <MetricCard key={index} {...stat} />
          ))}
        </div>

        {/* Dynamic Cluster Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Cluster Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clusters.map((cluster, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedCluster(cluster.name);
                    setShowClusterModal(true);
                  }}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  {" "}
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Server className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium  text-gray-700 dark:text-white">
                        {cluster.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Kubernetes {cluster.version}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-medium  text-gray-700 dark:text-white">
                        {cluster.cost}
                      </p>
                      <p className="text-muted-foreground">Cost</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium  text-gray-700 dark:text-white">
                        {cluster.cpu}
                      </p>
                      <p className="text-muted-foreground">CPU</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium  text-gray-700 dark:text-white">
                        {cluster.memory}
                      </p>
                      <p className="text-muted-foreground">Memory</p>
                    </div>
                  </div>
                  <StatusBadge status={cluster.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown Donut Chart */}
        <Card>
          <CardContent className="p-6 pb-16">
            <div className="flex justify-center">
              <DonutChart
                data={chartData.costBreakdown}
                title="Cost Breakdown by Cluster"
              />
            </div>
          </CardContent>
        </Card>
      </div>
      {showClusterModal && selectedCluster && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40  bg-opacity-40 backdrop-blur-sm transition-opacity"
            style={{ pointerEvents: "auto" }}
          />
          {/* Centered Modal */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 mt-2"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="h-[90vh]"
              style={{
                pointerEvents: "auto",
                maxWidth: "95vw",
                width: "100%",
                height: "80vh",
              }}
            >
              <ClusterDetailModal
                clusterName={selectedCluster}
                onClose={() => {
                  setShowClusterModal(false);
                  setSelectedCluster(null);
                }}
              />
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
