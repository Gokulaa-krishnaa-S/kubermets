// import { useEffect, useState } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Skeleton } from "@/components/ui/skeleton";
// import { GroupedBarChart } from "@/components/chart/GroupedBarChart";
// import ClusterService from "@/services/ClusterService";
// import { useSelectedHash } from "@/hooks/selected-hash";
// import { LineChart } from "@/components/chart/LineChart";

// export default function ClusterDetailModal({ clusterName, onClose }) {
//   const [cpuData, setCpuData] = useState([]);
//   const [memoryData, setMemoryData] = useState([]);
//   const [gpuData, setGpuData] = useState([]);
//   const [gpuMemoryData, setGpuMemoryData] = useState([]);
//   const [volumeData, setVolumeData] = useState([]);
//   const [networkData, setNetworkData] = useState([]);
//   const [podCountData, setPodCountData] = useState([]);

//   // ✅ Separate loading states
//   const [loadingCpu, setLoadingCpu] = useState(true);
//   const [loadingMemory, setLoadingMemory] = useState(true);
//   const [loadingGpu, setLoadingGpu] = useState(true);
//   const [loadingGpuMem, setLoadingGpuMem] = useState(true);
//   const [loadingVolume, setLoadingVolume] = useState(true);
//   const [loadingPods, setLoadingPods] = useState(true);

//   const { selectedHash } = useSelectedHash();

//   const fetchClusterStats = async () => {
//     try {
//       const res = await ClusterService.getClusterAllocationSummary({
//         window: "24h",
//         aggregate: "cluster",
//         accumulate: true,
//         shareIdle: true,
//         idleByNode: true,
//       });

//       const allocations = res?.data?.data?.sets?.[0]?.allocations || {};
//       const cluster = allocations[clusterName];
//       if (!cluster) return;

//       // CPU
//       setCpuData([
//         {
//           name: clusterName,
//           used: parseFloat(cluster.cpuCoreUsageAverage.toFixed(2)),
//           requested: parseFloat(cluster.cpuCoreRequestAverage.toFixed(2)),
//         },
//       ]);
//       setLoadingCpu(false);

//       // Memory
//       setMemoryData([
//         {
//           name: clusterName,
//           used: parseFloat(
//             (cluster.ramByteUsageAverage / 1024 ** 3).toFixed(2)
//           ),
//           requested: parseFloat(
//             (cluster.ramByteRequestAverage / 1024 ** 3).toFixed(2)
//           ),
//         },
//       ]);
//       setLoadingMemory(false);

//       // GPU
//       setGpuData([
//         {
//           name: clusterName,
//           used: parseFloat(cluster.gpuUsageAverage.toFixed(2)),
//           requested: parseFloat(cluster.gpuRequestAverage.toFixed(2)),
//         },
//       ]);
//       setLoadingGpu(false);

//       // GPU Memory (placeholder for now)
//       setGpuMemoryData([{ name: clusterName, used: 0, requested: 0 }]);
//       setLoadingGpuMem(false);
//     } catch (err) {
//       console.error("Failed to load cluster detail:", err);
//     }
//   };

//   const fetchPodData = async (queryParams) => {
//     try {
//       const res = await ClusterService.getClusterAllocationSummary(queryParams);
//       const allocations = res?.data?.data?.sets?.[0]?.allocations || {};

//       let activeCount = 0;
//       let idleCount = 0;
//       Object.keys(allocations).forEach((name) => {
//         if (name.startsWith("__idle__")) idleCount++;
//         else activeCount++;
//       });

//       const timestamp = new Date().toLocaleTimeString();
//       setPodCountData([
//         { time: timestamp, Active: activeCount, Idle: idleCount },
//       ]);
//     } catch (err) {
//       console.error("Failed to fetch pod data:", err);
//     } finally {
//       setLoadingPods(false);
//     }
//   };

//   // const fetchNetworkData = async (queryParams) => {
//   //   try {
//   //     const networkDataArr = [];

//   //     networkDataArr.push({
//   //       name: node["name"],
//   //       used: parseFloat((node["networkCost"] || 0).toFixed(2)),
//   //       requested: 0,
//   //     });

//   //   }
//   //   catch (err) {
//   //     console.error("Failed to fetch network data:", err);
//   //   }
//   // }

//   const fetchVolumeData = async (queryParams) => {
//     try {
//       const res = await ClusterService.getClusterAllocationSummary(queryParams);
//       const allocations = res?.data?.data?.sets?.[0]?.allocations || {};
//       const volumeDataArr = Object.values(allocations).map((node: any) => ({
//         name: node.name,
//         used: parseFloat((node["pvCost"] || 0).toFixed(2)),
//         requested: 0,
//       }));

//       setVolumeData(volumeDataArr);
//     } catch (err) {
//       console.error("Failed to fetch volume data:", err);
//     } finally {
//       setLoadingVolume(false);
//     }
//   };

//   useEffect(() => {
//     if (!clusterName) return;

//     fetchClusterStats();
//     fetchPodData({
//       window: "1h",
//       aggregate: "pod",
//       accumulate: true,
//       external: false,
//       shareCost: 0,
//       shareTenancyCosts: true,
//       idle: true,
//       shareIdle: false,
//       idleByNode: false,
//       shareLabels: "",
//       shareNamespaces: "",
//       shareSplit: "weighted",
//       filter: "",
//       offset: 0,
//       limit: 2000,
//       includeSharedCostBreakdown: true,
//       chartType: "costovertime",
//       costUnit: "cumulative",
//       domain: selectedHash || "",
//       force_refresh: true,
//     });

//     fetchVolumeData({
//       accumulate: true,
//       aggregate: "node",
//       chartType: "costovertime",
//       costUnit: "cumulative",
//       external: false,
//       filter: `(cluster:"${clusterName}")`,
//       idle: true,
//       idleByNode: false,
//       includeSharedCostBreakdown: true,
//       shareCost: 0,
//       shareIdle: false,
//       shareLabels: "",
//       shareNamespaces: "",
//       shareSplit: "weighted",
//       shareTenancyCosts: true,
//       window: "24h",
//       domain: selectedHash || "",
//       offset: 0,
//       limit: 25,
//     });
//   }, [clusterName]);

//   // fetchNetworkData({
//   //   accumulate: true,
//   //   aggregate: "node",
//   //   chartType: "costovertime",
//   //   costUnit: "cumulative",
//   //   external: false,
//   //   filter: `(cluster:"${clusterName}")`,
//   //   idle: true,
//   //   idleByNode: false,
//   //   includeSharedCostBreakdown: true,
//   //   shareCost: 0,
//   //   shareIdle: false,
//   //   shareLabels: "",
//   //   shareNamespaces: "",
//   //   shareSplit: "weighted",
//   //   shareTenancyCosts: true,
//   //   window: "24h",
//   //   domain: selectedHash || "",
//   //   offset: 0,
//   //   limit: 25,
//   // }]);

//   const ChartWrapper = ({ loading, children }) =>
//     loading ? <Skeleton className="h-[300px] w-full rounded-xl" /> : children;

//   return (
//     <Dialog open onOpenChange={onClose}>
//       <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
//         <DialogHeader>
//           <DialogTitle>Node-wise Details for {clusterName}</DialogTitle>
//         </DialogHeader>

//         <div className="overflow-y-auto mt-4 flex-1 pr-2">
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-14">
//             <ChartWrapper loading={loadingCpu}>
//               <GroupedBarChart
//                 data={cpuData}
//                 title="CPU Usage per Node"
//                 yAxisLabel="Cores"
//                 colors={["var(--color-primary-blue)", "var(--color-primary-green)"]}
//               />
//             </ChartWrapper>

//             <ChartWrapper loading={loadingPods}>
//               <LineChart
//                 data={podCountData}
//                 title="Active vs Idle Pods Over Time"
//                 yAxisLabel="Pod Count"
//                 lines={[
//                   { dataKey: "Active", name: "Active Pods", color: "var(--color-primary-green)" },
//                   { dataKey: "Idle", name: "Idle Pods", color: "var(--color-danger-red)" },
//                 ]}
//               />
//             </ChartWrapper>

//             <ChartWrapper loading={loadingMemory}>
//               <GroupedBarChart
//                 data={memoryData}
//                 title="Memory Usage per Node"
//                 yAxisLabel="GB"
//                 colors={["var(--color-warning-yellow)", "var(--color-success-lightgreen)"]}
//               />
//             </ChartWrapper>

//             <ChartWrapper loading={loadingGpu}>
//               <GroupedBarChart
//                 data={gpuData}
//                 title="GPU Usage per Node"
//                 yAxisLabel="GPUs"
//                 colors={["var(--color-purple)", "var(--color-pink)"]}
//               />
//             </ChartWrapper>

//             <ChartWrapper loading={loadingGpuMem}>
//               <GroupedBarChart
//                 data={gpuMemoryData}
//                 title="GPU Memory Usage per Node"
//                 yAxisLabel="GB"
//                 colors={["var(--color-cyan)", "var(--color-danger-pink)"]}
//               />
//             </ChartWrapper>

//             <ChartWrapper loading={loadingVolume}>
//               <GroupedBarChart
//                 data={volumeData}
//                 title="Volume Cost per Node ($)"
//                 yAxisLabel="$"
//                 colors={["var(--color-primary-blue)"]}
//               />
//             </ChartWrapper>

//             {/* <ChartWrapper loading={loadingVolume}>
//               <GroupedBarChart
//                 data={networkData}
//                 title="Network Cost per Node ($)"
//                 yAxisLabel="$"
//                 colors={["var(--color-danger-red)"]}
//               />
//             </ChartWrapper> */}
//           </div>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupedBarChart } from "@/components/chart/GroupedBarChart";
import ClusterService from "@/services/ClusterService";
import { useSelectedHash } from "@/hooks/selected-hash";

export default function ClusterDetailModal({ clusterName, onClose }) {
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

  const ChartCard = ({ loading, children }) => (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-4 flex flex-col">
      {loading ? <Skeleton className="h-full w-full rounded-lg" /> : children}
    </div>
  );

  const fetchClusterStats = async () => {
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
      window: "1h",
      aggregate: "pod",
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
      offset: 0,
      limit: 2000,
      includeSharedCostBreakdown: true,
      chartType: "costovertime",
      costUnit: "cumulative",
      domain: selectedHash || "",
      force_refresh: true,
    });

    fetchVolumeData({
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
      window: "24h",
      domain: selectedHash || "",
      offset: 0,
      limit: 25,
    });
  }, [clusterName]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Node-wise Details for {clusterName}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto overflow-x-hidden mt-4 flex-1 pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div whileHover={{ scale: 1.12 }}>
              <ChartCard loading={loadingCpu}>
                <GroupedBarChart
                  data={cpuData}
                  title="CPU Usage per Node"
                  yAxisLabel="Cores"
                  colors={["#3b82f6", "#10b981"]}
                />
              </ChartCard>
            </motion.div>

            <motion.div whileHover={{ scale: 1.12 }}>
              <ChartCard loading={loadingPods}>
                <GroupedBarChart
                  data={podCountData}
                  title="Active vs Idle Pods"
                  yAxisLabel="Pod Count"
                  colors={["#10b981", "#ef4444"]}
                />
              </ChartCard>
            </motion.div>
            <motion.div whileHover={{ scale: 1.12 }}>
              <ChartCard loading={loadingMemory}>
                <GroupedBarChart
                  data={memoryData}
                  title="Memory Usage per Node"
                  yAxisLabel="GB"
                  colors={["#f59e0b", "#84cc16"]}
                />
              </ChartCard>
            </motion.div>
            <motion.div whileHover={{ scale: 1.12 }}>
              <ChartCard loading={loadingGpu}>
                <GroupedBarChart
                  data={gpuData}
                  title="GPU Usage per Node"
                  yAxisLabel="GPUs"
                  colors={["#8b5cf6", "#ec4899"]}
                />
              </ChartCard>
            </motion.div>
            <motion.div whileHover={{ scale: 1.12 }}>
              <ChartCard loading={loadingGpuMem}>
                <GroupedBarChart
                  data={gpuMemoryData}
                  title="GPU Memory Usage per Node"
                  yAxisLabel="GB"
                  colors={["#06b6d4", "#f43f5e"]}
                />
              </ChartCard>
            </motion.div>
            <motion.div whileHover={{ scale: 1.12 }}>
              <ChartCard loading={loadingVolume}>
                <GroupedBarChart
                  data={volumeData}
                  title="Volume Cost per Node ($)"
                  yAxisLabel="$"
                  colors={["#3b82f6"]}
                />
              </ChartCard>
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
