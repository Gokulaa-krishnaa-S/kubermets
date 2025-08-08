import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GroupedBarChart } from "@/components/chart/GroupedBarChart";
import { LineChart } from "@/components/chart/LineChart";
import ClusterService from "@/services/ClusterService";

export default function ClusterDetailModal({ clusterName, onClose }) {
  const [cpuData, setCpuData] = useState([]);
  const [memoryData, setMemoryData] = useState([]);
  const [gpuData, setGpuData] = useState([]);
  const [gpuMemoryData, setGpuMemoryData] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [networkData, setNetworkData] = useState([]);

  const [nodeData, setNodeData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("24h");

  const thresholds = {
    cpuCritical: 90,
    cpuWarning: 80,
    ramCritical: 95,
    ramWarning: 85,
    cpuUsageWarning: 70,
    efficiencyWarning: 50,
  };

  const calculateUptime = (start, end) => {
    if (!start || !end) return "N/A";
    try {
      const startTime:any = new Date(start);
      const endTime:any = new Date(end);
      const diffMs = endTime - startTime;
      if (diffMs < 0) return "N/A";
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      return `${days}d ${hours}h`;
    } catch {
      return "N/A";
    }
  };

  const handleCallNodeData = async (params) => {
    try {
      const response = await ClusterService.getClusterAllocationSummary(params);
      return response.data;
    } catch (error) {
      console.error("Failed to fetch cluster summary", error);
      throw error;
    }
  };

  const fetchNodeData = async (queryParams) => {
    try {
      const response = await handleCallNodeData(queryParams);
      if (response.code !== 200 || !response.data?.sets?.[0]?.allocations) {
        throw new Error("Invalid response format");
      }

      const allocations:any = response.data.sets[0].allocations;
      const activeNodes:any = Object.values(allocations).filter(
        (node) =>
          !node["name"].startsWith("__") &&
          node["cpuCoreRequestAverage"] !== undefined
      );

      const totalNodes = activeNodes.length;
      const totalCost = activeNodes.reduce(
        (sum, node) => sum + (node["totalCost"] || 0),
        0
      );

      const avgCpuUsage =
        activeNodes.reduce((sum, node) => {
          const usage =
            (node["cpuCoreUsageAverage"] || 0) /
            (node["cpuCoreRequestAverage"] || 1);
          return sum + (isNaN(usage) ? 0 : usage);
        }, 0) / totalNodes;

      const avgEfficiency =
        activeNodes.reduce(
          (sum, node) => sum + (node["totalEfficiency"] || 0),
          0
        ) / totalNodes;

      setSummaryStats({
        totalNodes,
        totalCost,
        avgCpuUsage: avgCpuUsage * 100,
        avgEfficiency,
      });

      const volumeDataArr = [];
      const networkDataArr = [];

      const processedNodes = activeNodes.map((node) => {
        const cpuRequest = node["cpuCoreRequestAverage"] || 0;
        const cpuUsage = node["cpuCoreUsageAverage"] || 0;
        const cpuUtilization =
          cpuRequest > 0 ? (cpuUsage / cpuRequest) * 100 : 0;

        const ramUsageBytes = node["ramByteUsageAverage"] || 0;
        const ramRequestBytes = node["ramByteRequestAverage"] || 0;
        const ramUtilizationGB = ramUsageBytes / 1024 ** 3;
        const ramRequestGB = ramRequestBytes / 1024 ** 3;
        const ramUtilization =
          ramRequestBytes > 0
            ? Math.min((ramUsageBytes / ramRequestBytes) * 100, 100)
            : 0;

        if (ramRequestBytes > 0 && ramUsageBytes / ramRequestBytes > 1) {
          console.warn(
            `High RAM utilization for ${node["name"]}: ${(
              (ramUsageBytes / ramRequestBytes) * 100
            ).toFixed(1)}%`
          );
        }

        let status = "healthy";
        if (
          cpuUtilization > thresholds.cpuCritical ||
          ramUtilization > thresholds.ramCritical
        ) {
          status = "critical";
        } else if (
          cpuUtilization > thresholds.cpuWarning ||
          ramUtilization > thresholds.ramWarning
        ) {
          status = "warning";
        }

        // Push volume and network cost data
        volumeDataArr.push({
          name: node["name"],
          used: parseFloat((node["pvCost"] || 0).toFixed(2)),
          requested: 0,
        });

        networkDataArr.push({
          name: node["name"],
          used: parseFloat((node["networkCost"] || 0).toFixed(2)),
          requested: 0,
        });

        return {
          name: node["name"],
          status,
          cpuCores: cpuRequest.toFixed(1),
          cpuUsage: cpuUtilization.toFixed(1),
          ramRequest: ramRequestGB.toFixed(2),
          ramUsage: ramUtilizationGB.toFixed(2),
          ramUtilization: ramUtilization.toFixed(1),
          totalCost: (node["totalCost"] || 0).toFixed(2),
          cpuCost: (node["cpuCost"] || 0).toFixed(2),
          ramCost: (node["ramCost"] || 0).toFixed(2),
          pvCost: (node["pvCost"] || 0).toFixed(2),
          efficiency: (node["totalEfficiency"] || 0).toFixed(2),
          uptime: calculateUptime(node["start"], node["end"]),
        };
      });

      setNodeData(processedNodes);
      setVolumeData(volumeDataArr);
      setNetworkData(networkDataArr);
    } catch (err) {
      console.error("Failed to fetch node data:", err);
      setError("Unable to fetch node data.");
      setNodeData([]);
      setSummaryStats({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clusterName) return;

    const nodeQueryParams = {
      accumulate: true,
      aggregate: "node",
      chartType: "costovertime",
      costUnit: "cumulative",
      external: false,
      filter: `(cluster:"${clusterName}")`,
      idle: true,
      idleByNode: false,
      includeSharedCostBreakdown: true,
      shareCost: 0,
      shareIdle: false,
      shareLabels: "",
      shareNamespaces: "",
      shareSplit: "weighted",
      shareTenancyCosts: true,
      window: timeRange,
      offset: 0,
      limit: 25,
    };

    const fetchData = async () => {
      try {
        const res = await ClusterService.getClusterAllocationSummary({
          window: "24h",
          aggregate: "cluster",
          accumulate: true,
          shareIdle: true,
          idleByNode: true,
        });

        const allocations = res?.data?.data?.sets?.[0]?.allocations || {};
        const cluster = allocations[clusterName];
        if (!cluster) return;

        setCpuData([
          {
            name: clusterName,
            used: parseFloat(cluster.cpuCoreUsageAverage.toFixed(2)),
            requested: parseFloat(cluster.cpuCoreRequestAverage.toFixed(2)),
          },
        ]);

        setMemoryData([
          {
            name: clusterName,
            used: parseFloat(
              (cluster.ramByteUsageAverage / 1024 ** 3).toFixed(2)
            ),
            requested: parseFloat(
              (cluster.ramByteRequestAverage / 1024 ** 3).toFixed(2)
            ),
          },
        ]);

        setGpuData([
          {
            name: clusterName,
            used: parseFloat(cluster.gpuUsageAverage.toFixed(2)),
            requested: parseFloat(cluster.gpuRequestAverage.toFixed(2)),
          },
        ]);

        setGpuMemoryData([
          {
            name: clusterName,
            used: 0,
            requested: 0,
          },
        ]);
      } catch (err) {
        console.error("Failed to load cluster detail:", err);
      }
    };

    fetchData();
    fetchNodeData(nodeQueryParams);
  }, [clusterName]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Node-wise Details for {clusterName}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto mt-4 flex-1 pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-14">
            <GroupedBarChart
              data={cpuData}
              title="CPU Usage per Node"
              yAxisLabel="Cores"
              colors={["#3b82f6", "#10b981"]}
            />

            <GroupedBarChart
              data={memoryData}
              title="Memory Usage per Node"
              yAxisLabel="GB"
              colors={["#f59e0b", "#84cc16"]}
            />

            <GroupedBarChart
              data={gpuData}
              title="GPU Usage per Node"
              yAxisLabel="GPUs"
              colors={["#8b5cf6", "#ec4899"]}
            />

            <GroupedBarChart
              data={gpuMemoryData}
              title="GPU Memory Usage per Node"
              yAxisLabel="GB"
              colors={["#06b6d4", "#f43f5e"]}
            />

            <GroupedBarChart
              data={volumeData}
              title="Volume Cost per Node ($)"
              yAxisLabel="$"
              colors={["#3b82f6"]}
            />

            <GroupedBarChart
              data={networkData}
              title="Network Cost per Node ($)"
              yAxisLabel="$"
              colors={["#ef4444"]}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
