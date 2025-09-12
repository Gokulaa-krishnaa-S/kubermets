import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  Server, 
  Activity, 
  DollarSign, 
  Cpu
} from "lucide-react";

export const NodeMetricsLoader = ({ 
  title = "Node Metrics", 
  subtitle = "Loading comprehensive monitoring and resource analytics..." 
}) => {
  return (
    <div className="p-4 lg:p-6">
      <div className="min-h-screen bg-background">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col space-y-2">
            <div className="h-8 bg-gray-200 rounded-lg animate-pulse w-48"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-96 max-w-full"></div>
          </div>
        </div>

        {/* Filter Bar Skeleton */}
        <div className="mb-6 p-4 bg-white rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 bg-gray-200 rounded animate-pulse w-32"></div>
              <div className="h-10 bg-gray-200 rounded animate-pulse w-24"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 bg-gray-200 rounded animate-pulse w-20"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
            </div>
          </div>
        </div>

        <div className="mx-auto space-y-6">
          {/* Domain Dropdown Area */}
          <div className="flex items-center gap-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse w-40"></div>
          </div>

          {/* 4-Column Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Server className="w-5 h-5 text-gray-400" />, title: "Active Nodes" },
              { icon: <DollarSign className="w-5 h-5 text-gray-400" />, title: "Total Cost" },
              { icon: <Cpu className="w-5 h-5 text-gray-400" />, title: "Avg CPU Usage" },
              { icon: <Activity className="w-5 h-5 text-gray-400" />, title: "Avg Efficiency" }
            ].map((metric, index) => (
              <Card key={index} className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between space-y-0 pb-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
                    <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-8 bg-gray-200 rounded animate-pulse w-20"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-32"></div>
                  </div>
                </CardContent>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
              </Card>
            ))}
          </div>

          {/* Two-Column Chart Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Node Status Distribution - Pie Chart */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse w-48"></div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center items-center" style={{height: "300px"}}>
                  <div className="w-48 h-48 bg-gray-200 rounded-full animate-pulse relative">
                    {/* Pie chart segments simulation */}
                    <div className="absolute top-0 left-1/2 w-24 h-24 bg-gray-300 rounded-tl-full animate-pulse"></div>
                    <div className="absolute top-1/2 right-0 w-24 h-24 bg-gray-250 rounded-tr-full animate-pulse"></div>
                    <div className="absolute bottom-0 right-1/2 w-24 h-24 bg-gray-300 rounded-br-full animate-pulse"></div>
                  </div>
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>

            {/* Cost Breakdown - Bar Chart */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse w-44"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4" style={{height: "300px", paddingTop: "20px"}}>
                  {/* Simulated bar chart */}
                  <div className="flex items-end justify-center gap-4 h-full">
                    {[60, 80, 45, 70, 55].map((height, index) => (
                      <div key={index} className="flex flex-col items-center gap-2">
                        <div 
                          className="bg-gray-200 rounded animate-pulse w-12" 
                          style={{height: `${height}%`}}
                        ></div>
                        <div className="h-3 bg-gray-200 rounded animate-pulse w-8"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>
          </div>

          {/* Resource Utilization Line Chart */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse w-56"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" style={{height: "300px", paddingTop: "20px"}}>
                {/* Simulated line chart */}
                <div className="relative h-full">
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-rows-5 grid-cols-6 gap-0">
                    {Array.from({length: 30}).map((_, i) => (
                      <div key={i} className="border-gray-100 border-r border-b opacity-30"></div>
                    ))}
                  </div>
                  {/* Line curves simulation */}
                  <div className="absolute inset-4 flex items-center">
                    {[1, 2, 3].map((line) => (
                      <div key={line} className="flex-1 relative">
                        <div 
                          className={`h-1 bg-gray-300 rounded animate-pulse`}
                          style={{
                            width: '100%',
                            transform: `rotate(${-10 + line * 5}deg)`,
                            transformOrigin: 'left center'
                          }}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          </Card>

          {/* Node Details Table */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      {["Node", "Status", "CPU", "Memory", "Cost", "Efficiency", "Uptime"].map((header, index) => (
                        <th key={index} className="text-left p-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((row) => (
                      <tr key={row} className="border-b hover:bg-muted/50">
                        {/* Node Name */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-gray-400" />
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                          </div>
                        </td>
                        {/* Status Badge */}
                        <td className="p-3">
                          <div className="h-6 bg-gray-200 rounded-full animate-pulse w-16"></div>
                        </td>
                        {/* CPU */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-14"></div>
                          </div>
                        </td>
                        {/* Memory */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-16"></div>
                          </div>
                        </td>
                        {/* Cost */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-20"></div>
                          </div>
                        </td>
                        {/* Efficiency */}
                        <td className="p-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
                        </td>
                        {/* Uptime */}
                        <td className="p-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          </Card>
        </div>

        {/* Floating Activity Indicator */}
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex items-center gap-3 bg-white shadow-lg rounded-full px-4 py-3 border">
            <div className="relative">
              <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full animate-ping"></div>
            </div>
            <span className="text-sm font-medium text-gray-700">Loading node metrics...</span>
          </div>
        </div>
      </div>


      <style>
        {`
          @keyframes shimmer {
            100% {
              transform: translateX(100%);
            }
          }
        `}
      </style>
    </div>
  );
};