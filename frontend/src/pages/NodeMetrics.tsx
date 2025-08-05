import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Server,
  Cpu,
  Activity,
  DollarSign,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Layout } from "@/components/layout/Layout";

const NodeMetricsDashboard = () => {
  const [nodeData, setNodeData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configuration for thresholds
  const thresholds = {
    cpuCritical: 90,
    cpuWarning: 80,
    ramCritical: 95,
    ramWarning: 85,
    cpuUsageWarning: 70,
    efficiencyWarning: 50,
  };

  useEffect(() => {
    const fetchNodeData = async () => {
      try {
        const response = await fetch(
          "http://172.16.20.110/kubecost/model/allocation/summary?accumulate=true&aggregate=node&chartType=costovertime&costUnit=cumulative&external=false&filter=&idle=true&idleByNode=false&includeSharedCostBreakdown=true&shareCost=0&shareIdle=false&shareLabels=&shareNamespaces=&shareSplit=weighted&shareTenancyCosts=true&window=7d&offset=0&limit=25"
        );
        const result = await response.json();

        if (result.code !== 200 || !result.data?.sets?.[0]?.allocations) {
          throw new Error("Invalid response format");
        }

        const allocations = result.data.sets[0].allocations;

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

        const processedNodes = activeNodes.map((node) => {
          const cpuRequest = node["cpuCoreRequestAverage"] || 0;
          const cpuUsage = node["cpuCoreUsageAverage"] || 0;
          const cpuUtilization = cpuRequest > 0 ? (cpuUsage / cpuRequest) * 100 : 0;

          const ramUsageBytes = node["ramByteUsageAverage"] || 0;
          const ramRequestBytes = node["ramByteRequestAverage"] || 0;
          const ramUtilizationGB = ramUsageBytes / (1024 * 1024 * 1024);
          const ramRequestGB = ramRequestBytes / (1024 * 1024 * 1024);
          const ramUtilization = ramRequestBytes > 0
            ? Math.min((ramUsageBytes / ramRequestBytes) * 100, 100)
            : 0;

          if (ramRequestBytes > 0 && ramUsageBytes / ramRequestBytes > 1) {
            console.warn(`High RAM utilization for ${node["name"]}: ${(ramUsageBytes / ramRequestBytes) * 100}%`);
          }

          let status = "healthy";
          if (cpuUtilization > thresholds.cpuCritical || ramUtilization > thresholds.ramCritical) {
            status = "critical";
          } else if (cpuUtilization > thresholds.cpuWarning || ramUtilization > thresholds.ramWarning) {
            status = "warning";
          }

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
            uptime: calculateUptime(node["start"] || "", node["end"] || ""),
          };
        });

        setNodeData(processedNodes);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Unable to fetch node data.");
        setNodeData([]);
        setSummaryStats({});
      } finally {
        setLoading(false);
      }
    };

    fetchNodeData();
  }, []);

  const calculateUptime = (start, end) => {
    if (!start || !end) return "N/A";

    try {
      const startTime:any = new Date(start);
      const endTime :any = new Date(end);
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

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      healthy: { bg: "bg-green-100", text: "text-green-800", label: "Healthy" },
      warning: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Warning" },
      critical: { bg: "bg-red-100", text: "text-red-800", label: "Critical" },
    };

    const config = statusConfig[status] || statusConfig.healthy;

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  const MetricCard = ({ title, value, subtitle, icon, status }) => {
    const statusColors = {
      healthy: "border-green-200 bg-green-50",
      warning: "border-yellow-200 bg-yellow-50",
      critical: "border-red-200 bg-red-50",
      info: "border-blue-200 bg-blue-50",
    };

    return (
      <Card className={`${statusColors[status] || statusColors.info}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-medium text-gray-600">{title}</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const costBreakdownData = nodeData.map((node) => ({
    name: node["name"].replace("k8gwell", ""),
    cpu: parseFloat(node["cpuCost"]),
    ram: parseFloat(node["ramCost"]),
    storage: parseFloat(node["pvCost"]),
    total: parseFloat(node["totalCost"]),
  }));

  const utilizationData = nodeData.map((node) => ({
    name: node["name"].replace("k8gwell", ""),
    cpuUsage: parseFloat(node["cpuUsage"]),
    ramUsage: parseFloat(node["ramUtilization"]),
    efficiency: parseFloat(node["efficiency"]),
  }));

  const statusDistribution = nodeData.reduce((acc, node) => {
    acc[node["status"]] = (acc[node["status"]] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusDistribution).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color:
      status === "healthy"
        ? "#10B981"
        : status === "warning"
        ? "#F59E0B"
        : "#EF4444",
  }));

  if (loading) {
    return (
      <Layout title="Node Metrics" subtitle="CPU, memory, disk, network, and node health monitoring">
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center text-gray-600">Loading...</div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Node Metrics" subtitle="CPU, memory, disk, network, and node health monitoring">
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center text-red-600">{error}</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Node Metrics"
      subtitle="CPU, memory, disk, network, and node health monitoring"
    >
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Node Metrics Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Monitor CPU, memory, costs, and node health across your Kubernetes cluster
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Active Nodes"
              value={summaryStats["totalNodes"]?.toString() || "0"}
              subtitle="All nodes operational"
              icon={<Server className="w-5 h-5 text-blue-600" />}
              status="info"
            />
            <MetricCard
              title="Total Cost"
              value={`$${summaryStats["totalCost"]?.toFixed(2) || "0.00"}`}
              subtitle="Last 7 days"
              icon={<DollarSign className="w-5 h-5 text-green-600" />}
              status="info"
            />
            <MetricCard
              title="Avg CPU Usage"
              value={`${summaryStats["avgCpuUsage"]?.toFixed(1) || "0.0"}%`}
              subtitle="Across all nodes"
              icon={<Cpu className="w-5 h-5 text-orange-600" />}
              status={summaryStats["avgCpuUsage"] > thresholds.cpuUsageWarning ? "warning" : "healthy"}
            />
            <MetricCard
              title="Avg Efficiency"
              value={`${summaryStats["avgEfficiency"]?.toFixed(1) || "0.0"}%`}
              subtitle="Resource utilization"
              icon={<Activity className="w-5 h-5 text-purple-600" />}
              status={summaryStats["avgEfficiency"] < thresholds.efficiencyWarning ? "warning" : "healthy"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Node Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown by Node</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costBreakdownData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, ""]} />
                    <Bar
                      dataKey="cpu"
                      stackId="cost"
                      fill="#EF4444"
                      name="CPU"
                    />
                    <Bar
                      dataKey="ram"
                      stackId="cost"
                      fill="#3B82F6"
                      name="RAM"
                    />
                    <Bar
                      dataKey="storage"
                      stackId="cost"
                      fill="#10B981"
                      name="Storage"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resource Utilization by Node</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={utilizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}%`, ""]} />
                  <Line
                    type="monotone"
                    dataKey="cpuUsage"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="CPU Usage %"
                  />
                  <Line
                    type="monotone"
                    dataKey="ramUsage"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="RAM Usage %"
                  />
                  <Line
                    type="monotone"
                    dataKey="efficiency"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Efficiency %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Node Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-primary">
                      <th className="text-left p-3 font-medium">Node</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">CPU</th>
                      <th className="text-left p-3 font-medium">Memory</th>
                      <th className="text-left p-3 font-medium">Cost</th>
                      <th className="text-left p-3 font-medium">Efficiency</th>
                      <th className="text-left p-3 font-medium">Uptime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodeData.map((node, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 text-foreground">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{node["name"]}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <StatusBadge status={node["status"]} />
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <div>{node["cpuUsage"]}%</div>
                            <div className="text-gray-500 text-xs">
                              {node["cpuCores"]} cores
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <div>{node["ramUtilization"]}%</div>
                            <div className="text-gray-500 text-xs">
                              {node["ramUsage"]}GB used
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <div className="font-medium">
                              ${node["totalCost"]}
                            </div>
                            <div className="text-gray-500 text-xs">
                              CPU: ${node["cpuCost"]} | RAM: ${node["ramCost"]}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-sm font-medium ${
                              parseFloat(node["efficiency"]) > 5
                                ? "text-green-600"
                                : parseFloat(node["efficiency"]) > 1
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {node["efficiency"]}%
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {node["uptime"]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default NodeMetricsDashboard;