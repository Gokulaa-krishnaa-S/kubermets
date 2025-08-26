import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GroupedBarChart } from "@/components/chart/GroupedBarChart";
import ClusterService from "@/services/ClusterService";
import { useSelectedHash } from "@/hooks/selected-hash";
import ChartCard from "../ui/chartCard";
import cluster from "cluster";

const chartDetails = {
  cpu: {
    title: "CPU Usage per Node",
    description:
      "This chart displays the CPU core utilization across cluster nodes, comparing actual usage against requested resources.",
    metrics: ["Used Cores", "Requested Cores"],
    insights:
      "Monitor for over-allocation or under-utilization patterns to optimize resource planning.",
  },
  memory: {
    title: "Memory Usage per Node",
    description:
      "Memory consumption in gigabytes showing actual RAM usage versus requested memory allocations.",
    metrics: ["Used Memory (GB)", "Requested Memory (GB)"],
    insights:
      "Track memory efficiency and identify nodes that may need scaling adjustments.",
  },
  gpu: {
    title: "GPU Usage per Node",
    description:
      "GPU resource utilization showing the number of GPUs being used versus those requested.",
    metrics: ["Used GPUs", "Requested GPUs"],
    insights:
      "Essential for ML workloads - monitor GPU allocation efficiency and availability.",
  },
  gpuMemory: {
    title: "GPU Memory Usage per Node",
    description:
      "GPU memory consumption in gigabytes for graphics processing workloads.",
    metrics: ["Used GPU Memory (GB)", "Requested GPU Memory (GB)"],
    insights:
      "Critical for deep learning tasks requiring high memory bandwidth.",
  },
  pods: {
    title: "Active vs Idle Pods",
    description:
      "Real-time comparison of active pods performing work versus idle pods consuming resources.",
    metrics: ["Active Pods", "Idle Pods"],
    insights:
      "High idle pod counts may indicate over-provisioning or scheduling inefficiencies.",
  },
  volume: {
    title: "Volume Cost per Node",
    description:
      "Storage costs associated with persistent volumes across cluster nodes.",
    metrics: ["Volume Cost ($)"],
    insights:
      "Track storage expenses and identify opportunities for cost optimization.",
  },
};

export default function ClusterDetailModal({
  clusterId,
  clusterName,
  onClose,
}) {
  const [cpuData, setCpuData] = useState([]);
  const [memoryData, setMemoryData] = useState([]);
  const [gpuData, setGpuData] = useState([]);
  const [gpuMemoryData, setGpuMemoryData] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [podCountData, setPodCountData] = useState([]);

  const [loadingCpu, setLoadingCpu] = useState(true);
  const [loadingMemory, setLoadingMemory] = useState(true);
  const [loadingGpu, setLoadingGpu] = useState(true);
  const [loadingGpuMem, setLoadingGpuMem] = useState(true);
  const [loadingVolume, setLoadingVolume] = useState(true);
  const [loadingPods, setLoadingPods] = useState(true);

  const { selectedHash } = useSelectedHash();

  const fetchClusterStats = async () => {
    try {
      const res = await ClusterService.getClusterAllocationSummary({
        user_id: 1,
        cluster_id: 1,
        window:"6d",
      });

      console.log("res is here", res);
      const allocations = res?.data || {};
      const cluster = allocations[clusterName];
      if (!cluster) return;

      setCpuData([
        {
          name: clusterName,
          used: parseFloat(cluster.cpuCoreUsageAverage.toFixed(2)),
          requested: parseFloat(cluster.cpuCoreRequestAverage.toFixed(2)),
        },
      ]);
      setLoadingCpu(false);

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
      setLoadingMemory(false);

      setGpuData([
        {
          name: clusterName,
          used: parseFloat(cluster.gpuUsageAverage.toFixed(2)),
          requested: parseFloat(cluster.gpuRequestAverage.toFixed(2)),
        },
      ]);
      setLoadingGpu(false);

      setGpuMemoryData([{ name: clusterName, used: 0, requested: 0 }]);
      setLoadingGpuMem(false);
    } catch (err) {
      console.error("Failed to load cluster detail:", err);
    }
  };

  const fetchPodData = async (queryParams) => {
    try {
      const res = await ClusterService.getClusterAllocationSummary(queryParams);
      const allocations = res?.data?.data?.sets?.[0]?.allocations || {};

      let activeCount = 0;
      let idleCount = 0;
      Object.keys(allocations).forEach((name) => {
        if (name.startsWith("__idle__")) idleCount++;
        else activeCount++;
      });

      const timestamp = new Date().toLocaleTimeString();
      setPodCountData([
        { name: timestamp, used: activeCount, requested: idleCount },
      ]);
    } catch (err) {
      console.error("Failed to fetch pod data:", err);
    } finally {
      setLoadingPods(false);
    }
  };

  const fetchVolumeData = async (queryParams) => {
    try {
      const res = await ClusterService.getClusterAllocationSummary(queryParams);
      const allocations = res?.data?.data?.sets?.[0]?.allocations || {};
      const volumeDataArr = Object.values(allocations).map((node: any) => ({
        name: node.name,
        used: parseFloat((node["pvCost"] || 0).toFixed(2)),
        requested: 0,
      }));

      setVolumeData(volumeDataArr);
    } catch (err) {
      console.error("Failed to fetch volume data:", err);
    } finally {
      setLoadingVolume(false);
    }
  };

  useEffect(() => {
    if (!clusterName) return;

    fetchClusterStats();
    fetchPodData({
      user_id: 1,
      cluster_id: 1,
      window:"6d",
    });

    fetchVolumeData({ user_id: 1, cluster_id: 1, window:"6d" });
  }, [clusterName]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Node-wise Details for {clusterName}
          </DialogTitle>
        </DialogHeader>

        <style>{`
          .perspective-1000 {
            perspective: 1000px;
          }
          .preserve-3d {
            transform-style: preserve-3d;
          }
          .backface-hidden {
            backface-visibility: hidden;
          }
          .rotate-y-180 {
            transform: rotateY(180deg);
          }
        `}</style>

        <div className="overflow-y-auto overflow-x-hidden scrollbar-hide mt-4 flex-1 pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ChartCard loading={loadingCpu} details={chartDetails.cpu}>
              <GroupedBarChart
                data={cpuData}
                title="CPU Usage per Node"
                yAxisLabel="Cores"
                colors={["#3b82f6", "#10b981"]}
              />
            </ChartCard>

            <ChartCard loading={loadingPods} details={chartDetails.pods}>
              <GroupedBarChart
                data={podCountData}
                title="Active vs Idle Pods"
                yAxisLabel="Pod Count"
                colors={["#10b981", "#ef4444"]}
              />
            </ChartCard>

            <ChartCard loading={loadingMemory} details={chartDetails.memory}>
              <GroupedBarChart
                data={memoryData}
                title="Memory Usage per Node"
                yAxisLabel="GB"
                colors={["#f59e0b", "#84cc16"]}
              />
            </ChartCard>

            <ChartCard loading={loadingGpu} details={chartDetails.gpu}>
              <GroupedBarChart
                data={gpuData}
                title="GPU Usage per Node"
                yAxisLabel="GPUs"
                colors={["#8b5cf6", "#ec4899"]}
              />
            </ChartCard>

            <ChartCard loading={loadingGpuMem} details={chartDetails.gpuMemory}>
              <GroupedBarChart
                data={gpuMemoryData}
                title="GPU Memory Usage per Node"
                yAxisLabel="GB"
                colors={["#06b6d4", "#f43f5e"]}
              />
            </ChartCard>

            <ChartCard loading={loadingVolume} details={chartDetails.volume}>
              <GroupedBarChart
                data={volumeData}
                title="Volume Cost per Node ($)"
                yAxisLabel="$"
                colors={["#3b82f6"]}
              />
            </ChartCard>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
