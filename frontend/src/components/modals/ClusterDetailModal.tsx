import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GroupedBarChart } from "@/components/chart/GroupedBarChart";
import ClusterService from "@/services/ClusterService";
import podService from "@/services/podService";
import { useSelectedHash } from "@/hooks/selected-hash";
import ChartCard from "../ui/chartCard";

const chartDetails = {
  cpu: {
    title: "CPU Usage per Cluster",
    description:
      "This chart displays the CPU core utilization across the cluster, comparing actual usage against requested resources.",
    metrics: ["Used Cores", "Requested Cores"],
    insights:
      "Monitor for over-allocation or under-utilization patterns to optimize resource planning.",
  },
  memory: {
    title: "Memory Usage per Cluster",
    description:
      "Memory consumption in gigabytes showing actual RAM usage versus requested memory allocations.",
    metrics: ["Used Memory (GB)", "Requested Memory (GB)"],
    insights:
      "Track memory efficiency and identify clusters that may need scaling adjustments.",
  },
  gpu: {
    title: "GPU Usage per Cluster",
    description:
      "GPU resource utilization showing the number of GPUs being used versus those requested.",
    metrics: ["Used GPUs", "Requested GPUs"],
    insights:
      "Essential for ML workloads - monitor GPU allocation efficiency and availability.",
  },
  gpuMemory: {
    title: "GPU Memory Usage per Cluster",
    description:
      "GPU memory consumption in gigabytes for graphics processing workloads.",
    metrics: ["Used GPU Memory (GB)", "Requested GPU Memory (GB)"],
    insights:
      "Critical for deep learning tasks requiring high memory bandwidth. (Currently not available in API)",
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
    title: "Volume Cost per Cluster",
    description:
      "Storage costs associated with persistent volumes in the cluster.",
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

  const [error, setError] = useState(null);

  const { selectedHash } = useSelectedHash();

  // Fetch cluster-level metrics (CPU, Memory, GPU, Volume)
  const fetchClusterStats = async () => {
    try {
      setError(null);
      
      const res = await ClusterService.getClusterDetails({
        user_id: 1,
        cluster_id: clusterId || 1,
        window: "6d",
      });

      console.log("Cluster API response:", res);
      
      // Access the data array correctly
      const clusterData = res?.data || [];
      
      if (!Array.isArray(clusterData) || clusterData.length === 0) {
        throw new Error("No cluster data received from API");
      }
      
      // Filter out idle allocations and find the specific cluster
      const activeCluster = clusterData.find(
        cluster => cluster.cluster_name === clusterName && !cluster.is_idle_allocation
      );
      
      if (!activeCluster) {
        console.warn(`No active cluster found with name: ${clusterName}`);
        // Try to find any cluster with the given name (including idle)
        const anyCluster = clusterData.find(cluster => cluster.cluster_name === clusterName);
        if (!anyCluster) {
          throw new Error(`Cluster "${clusterName}" not found in API response`);
        }
        // Use the idle cluster data as fallback
        processClusterData(anyCluster);
        return;
      }

      processClusterData(activeCluster);

    } catch (err) {
      console.error("Failed to load cluster detail:", err);
      setError(err.message || "Failed to load cluster data");
      
      // Set cluster-related loading states to false on error
      setLoadingCpu(false);
      setLoadingMemory(false);
      setLoadingGpu(false);
      setLoadingGpuMem(false);
      setLoadingVolume(false);
    }
  };

  // Process cluster data for charts
  const processClusterData = (cluster) => {
    try {
      // CPU Data - using correct field names from API
      setCpuData([
        {
          name: cluster.cluster_name,
          used: parseFloat((cluster.cpu_core_usage_average || 0).toFixed(2)),
          requested: parseFloat((cluster.cpu_core_request_average || 0).toFixed(2)),
        },
      ]);
      setLoadingCpu(false);

      // Memory Data - API already provides GB values
      setMemoryData([
        {
          name: cluster.cluster_name,
          used: parseFloat((cluster.memory_gb_used || 0).toFixed(2)),
          requested: parseFloat((cluster.memory_gb_requested || 0).toFixed(2)),
        },
      ]);
      setLoadingMemory(false);

      // GPU Data
      setGpuData([
        {
          name: cluster.cluster_name,
          used: parseFloat((cluster.gpu_usage_average || 0).toFixed(2)),
          requested: parseFloat((cluster.gpu_request_average || 0).toFixed(2)),
        },
      ]);
      setLoadingGpu(false);

      // GPU Memory Data - Not available in current API response
      setGpuMemoryData([
        { 
          name: cluster.cluster_name, 
          used: 0, // Not available in API
          requested: 0 // Not available in API
        }
      ]);
      setLoadingGpuMem(false);

      // Volume/Storage Cost Data
      setVolumeData([
        {
          name: cluster.cluster_name,
          used: parseFloat((cluster.pv_cost || 0).toFixed(2)),
          requested: 0, // No requested volume cost in API
        },
      ]);
      setLoadingVolume(false);

    } catch (err) {
      console.error("Error processing cluster data:", err);
      setError("Error processing cluster data");
    }
  };

  // Fetch pod-level metrics for Active vs Idle pods chart
  const fetchPodData = async () => {
    try {
      setError(null);
      
      const res = await podService.getPodMetrics({
        user_id: 1,
        cluster_id: clusterId || 1,
        duration: "60d",
      });

      console.log("Pod API response:", res);
      
      // Access the data array correctly
      const podData = res?.data || [];

      console.log("pod data:", podData);
      
      if (!Array.isArray(podData) || podData.length === 0) {
        console.warn("No pod data received from API");
        setPodCountData([
          {
            name: clusterName,
            active: 0,
            idle: 0,
          },
        ]);
        setLoadingPods(false);
        return;
      }
      
      // Count active and idle pods (excluding the __idle__ system entry)
      let activeCount = 0;
      let idleCount = 0;
      
      podData.forEach((pod) => {
        // Skip the system __idle__ entry
        if (pod.name === "__idle__" || pod.id === "__idle__") {
          return;
        }
        
        if (pod.isIdle) {
          idleCount++;
        } else {
          activeCount++;
        }
      });

      setPodCountData([
        {
          name: clusterName,
          active: activeCount,
          idle: idleCount,
        },
      ]);

      console.log("pod data in state is:", podCountData);
      
      setLoadingPods(false);

    } catch (err) {
      console.error("Failed to fetch pod data:", err);
      setError("Failed to load pod data: " + (err.message || "Unknown error"));
      setPodCountData([
        {
          name: clusterName,
          active: 0,
          idle: 0,
        },
      ]);
      setLoadingPods(false);
    }
  };

  useEffect(() => {
    if (!clusterName) {
      setError("Cluster name is required");
      return;
    }
    
    // Fetch data from both APIs
    fetchClusterStats();
    fetchPodData();
  }, [clusterName, clusterId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Cluster Details for {clusterName}
            {clusterId && <span className="text-sm text-gray-500 ml-2">(ID: {clusterId})</span>}
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
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex">
              <div className="text-red-800 text-sm">
                <strong>Error:</strong> {error}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-y-auto overflow-x-hidden scrollbar-hide mt-4 flex-1 pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* CPU Usage Chart - ClusterService */}
            <ChartCard loading={loadingCpu} details={chartDetails.cpu}>
              <GroupedBarChart
                data={cpuData}
                title="CPU Usage per Cluster"
                yAxisLabel="Cores"
                colors={["#3b82f6", "#10b981"]}
                // dataKeys={["used", "requested"]}
              />
            </ChartCard>

            {/* Memory Usage Chart - ClusterService */}
            <ChartCard loading={loadingMemory} details={chartDetails.memory}>
              <GroupedBarChart
                data={memoryData}
                title="Memory Usage per Cluster"
                yAxisLabel="GB"
                colors={["#f59e0b", "#84cc16"]}
                // dataKeys={["used", "requested"]}
              />
            </ChartCard>

            {/* GPU Usage Chart - ClusterService */}
            <ChartCard loading={loadingGpu} details={chartDetails.gpu}>
              <GroupedBarChart
                data={gpuData}
                title="GPU Usage per Cluster"
                yAxisLabel="GPUs"
                colors={["#8b5cf6", "#ec4899"]}
                // dataKeys={["used", "requested"]}
              />
            </ChartCard>

            {/* GPU Memory Chart - ClusterService (Limited Data) */}
            <ChartCard loading={loadingGpuMem} details={chartDetails.gpuMemory}>
              <div className="relative">
                <GroupedBarChart
                  data={gpuMemoryData}
                  title="GPU Memory Usage per Cluster"
                  yAxisLabel="GB"
                  colors={["#06b6d4", "#f43f5e"]}
                  // dataKeys={["used", "requested"]}
                />
                <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                  Data Not Available
                </div>
              </div>
            </ChartCard>

            {/* Active vs Idle Pods Chart - PodService */}
            <ChartCard loading={loadingPods} details={chartDetails.pods}>
              <GroupedBarChart
                data={podCountData}
                title="Active vs Idle Pods"
                yAxisLabel="Pod Count"
                colors={["#10b981", "#ef4444"]}
                // dataKeys={["active", "idle"]}
              />
            </ChartCard>

            {/* Volume Cost Chart - ClusterService */}
            <ChartCard loading={loadingVolume} details={chartDetails.volume}>
              <GroupedBarChart
                data={volumeData}
                title="Volume Cost per Cluster"
                yAxisLabel="Cost ($)"
                colors={["#3b82f6"]}
                // dataKeys={["used"]}
              />
            </ChartCard>

          </div>
        </div>

        {/* Data Summary Section */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Quick Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">CPU Efficiency:</span>
              <span className="ml-2 font-medium">
                {cpuData[0]?.requested > 0 ? 
                  `${((cpuData[0]?.used / cpuData[0]?.requested) * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Memory Efficiency:</span>
              <span className="ml-2 font-medium">
                {memoryData[0]?.requested > 0 ? 
                  `${((memoryData[0]?.used / memoryData[0]?.requested) * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Active Pods:</span>
              <span className="ml-2 font-medium">{podCountData[0]?.active || 0}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Idle Pods:</span>
              <span className="ml-2 font-medium">{podCountData[0]?.idle || 0}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Storage Cost:</span>
              <span className="ml-2 font-medium">${volumeData[0]?.used || 0}</span>
            </div>
          </div>
          
          {/* Additional Pod Efficiency Metric */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">Pod Efficiency:</span>
              <span className="ml-2 font-medium">
                {(podCountData[0]?.active > 0 || podCountData[0]?.idle > 0) ? 
                  `${((podCountData[0]?.active / (podCountData[0]?.active + podCountData[0]?.idle)) * 100).toFixed(1)}%` : 'N/A'}
              </span>
              <span className="ml-2 text-gray-500 text-xs">
                ({podCountData[0]?.active || 0} active / {(podCountData[0]?.active || 0) + (podCountData[0]?.idle || 0)} total)
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}