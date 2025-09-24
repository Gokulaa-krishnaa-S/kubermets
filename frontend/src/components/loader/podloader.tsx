import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  DollarSign, 
  Server, 
  Clock, 
  Activity,
  TrendingUp,
  Database,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from "lucide-react";

export const PodMetricsLoader = ({ 
  title = "Pod Metrics", 
  subtitle = "Loading comprehensive monitoring and resource analytics..." 
}) => {
  return (
    <div className="p-4 lg:p-6">
      <div className="min-h-screen p-6">
        <div className="mx-auto">
          {/* Enhanced Filter Bar with Search */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Left side - Time Range */}
              <div className="flex items-center gap-4">
                <div className="h-10 bg-gray-200 rounded animate-pulse w-32"></div>
              </div>

              {/* Center - Search */}
              <div className="flex-1 max-w-md">
                <div className="h-10 bg-gray-200 rounded animate-pulse w-full"></div>
              </div>

              {/* Domain Dropdown Area */}
              <div className="flex items-center gap-4">
                <div className="h-10 bg-gray-200 rounded animate-pulse w-32"></div>
              </div>

              {/* Right side - Refresh Controls */}
              <div className="flex items-center gap-3">
                <div className="h-10 bg-gray-200 rounded animate-pulse w-24"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
              </div>
            </div>

            {/* Search Results Info */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                <div className="h-8 bg-gray-200 rounded animate-pulse w-24"></div>
              </div>
            </div>
          </div>

          {/* Summary Cards - 4 columns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { icon: <DollarSign className="w-6 h-6 text-gray-400" />, bg: "bg-blue-100" },
              { icon: <Server className="w-6 h-6 text-gray-400" />, bg: "bg-green-100" },
              { icon: <Clock className="w-6 h-6 text-gray-400" />, bg: "bg-orange-100" },
              { icon: <Activity className="w-6 h-6 text-gray-400" />, bg: "bg-purple-100" }
            ].map((card, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-20 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded animate-pulse w-16 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
                  </div>
                  <div className={`p-3 ${card.bg} rounded-lg`}>
                    {card.icon}
                  </div>
                </div>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
              </div>
            ))}
          </div>

          {/* Charts Section - 3 column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Cost Over Time Chart - 2/3 width */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-lg hover:shadow-xl transition-shadow duration-300 relative overflow-hidden">
              {/* Chart Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-4 sm:mb-0">
                  <div className="p-2 bg-gray-200 rounded-lg animate-pulse">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-40 mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-20 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-16"></div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-6 mb-6 p-4 bg-slate-50 rounded-xl">
                {["CPU", "Memory", "Storage"].map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
                    <div className="h-6 bg-gray-200 rounded-full animate-pulse w-12"></div>
                  </div>
                ))}
              </div>

              {/* Chart Area */}
              <div className="relative">
                <div className="overflow-x-auto overflow-y-hidden">
                  <div style={{ minWidth: "800px", width: "100%" }}>
                    <div style={{ height: "400px" }} className="relative">
                      {/* Simulated Bar Chart */}
                      <div className="absolute inset-0 flex items-end justify-center gap-2 p-4">
                        {Array.from({length: 12}).map((_, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1 max-w-16">
                            {/* Stacked bars */}
                            <div className="w-full space-y-0 flex flex-col-reverse">
                              <div className="bg-blue-300 animate-pulse rounded-b" style={{height: `${20 + (i * 10)}px`}}></div>
                              <div className="bg-emerald-300 animate-pulse" style={{height: `${15 + (i * 8)}px`}}></div>
                              <div className="bg-amber-300 animate-pulse rounded-t" style={{height: `${10 + (i * 5)}px`}}></div>
                            </div>
                            {/* Pod name placeholder */}
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-full"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scroll indicator */}
                <div className="flex justify-center mt-2">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-40"></div>
                  </div>
                </div>
              </div>

              {/* Chart footer stats */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { bg: "bg-slate-50", label: "Total Pods" },
                    { bg: "bg-blue-50", label: "Compute" },
                    { bg: "bg-amber-50", label: "Storage" }
                  ].map((stat, index) => (
                    <div key={index} className={`text-center p-3 ${stat.bg} rounded-lg`}>
                      <div className="h-5 bg-gray-200 rounded animate-pulse w-12 mx-auto mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-16 mx-auto"></div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </div>

            {/* Cost Distribution Pie Chart - 1/3 width */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="h-6 bg-gray-200 rounded animate-pulse w-32 mb-6"></div>
              
              {/* Pie Chart Placeholder */}
              <div className="flex justify-center items-center" style={{height: "300px"}}>
                <div className="w-48 h-48 bg-gray-200 rounded-full animate-pulse relative">
                  {/* Inner circle for donut */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white rounded-full"></div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="mt-4 space-y-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
                  </div>
                ))}
              </div>
              
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </div>
          </div>

          {/* Pod Details Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
            {/* Table Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="h-6 bg-gray-200 rounded animate-pulse w-48"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {["Pod Name", "CPU Cost", "Memory Cost", "Storage Cost", "Efficiency", "Total Cost"].map((header, index) => (
                      <th key={index} className="px-6 py-3 text-left">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.from({length: 10}).map((_, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                      {/* Pod Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-gray-200 rounded-lg mr-3 animate-pulse">
                            <Database className="w-4 h-4 text-gray-400" />
                          </div>
                          <div>
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-32"></div>
                          </div>
                        </div>
                      </td>
                      {/* CPU Cost */}
                      <td className="px-6 py-4 text-right">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-16 mb-1 ml-auto"></div>
                        <div className="h-3 bg-gray-200 rounded animate-pulse w-12 ml-auto"></div>
                      </td>
                      {/* Memory Cost */}
                      <td className="px-6 py-4 text-right">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-16 mb-1 ml-auto"></div>
                        <div className="h-3 bg-gray-200 rounded animate-pulse w-20 ml-auto"></div>
                      </td>
                      {/* Storage Cost */}
                      <td className="px-6 py-4 text-right">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-12 ml-auto"></div>
                      </td>
                      {/* Efficiency */}
                      <td className="px-6 py-4 text-right">
                        <div className="h-6 bg-gray-200 rounded-full animate-pulse w-16 ml-auto"></div>
                      </td>
                      {/* Total Cost */}
                      <td className="px-6 py-4 text-right">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-16 ml-auto"></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Rows per page */}
                <div className="flex items-center gap-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                  <div className="h-8 bg-gray-200 rounded animate-pulse w-16"></div>
                </div>

                {/* Page navigation */}
                <div className="flex items-center gap-4">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                  
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 text-sm border border-gray-300 rounded opacity-50">
                      First
                    </button>
                    <button className="p-2 border border-gray-300 rounded opacity-50">
                      <ChevronLeft className="w-4 h-4 text-gray-400" />
                    </button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((page) => (
                        <div key={page} className="h-8 bg-gray-200 rounded animate-pulse w-8"></div>
                      ))}
                    </div>
                    
                    <button className="p-2 border border-gray-300 rounded opacity-50">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    <button className="px-3 py-1 text-sm border border-gray-300 rounded opacity-50">
                      Last
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          </div>

          {/* Idle Resources Section */}
          <div className="mt-8 bg-orange-50 rounded-xl p-6 border border-orange-200 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              <div className="h-6 bg-orange-200 rounded animate-pulse w-32"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["CPU Cost", "Memory Cost", "Total Idle Cost"].map((label, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="h-4 bg-orange-200 rounded animate-pulse w-16 mb-2"></div>
                  <div className="h-6 bg-orange-200 rounded animate-pulse w-20"></div>
                </div>
              ))}
            </div>
            <div className="h-4 bg-orange-200 rounded animate-pulse w-full mt-4"></div>
            
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-orange-100/60 to-transparent"></div>
          </div>
        </div>
      </div>

      {/* Floating Activity Indicator */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex items-center gap-3 bg-white shadow-lg rounded-full px-4 py-3 border">
          <div className="relative">
            <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full animate-ping"></div>
          </div>
          <span className="text-sm font-medium text-gray-700">Loading pod metrics...</span>
        </div>
      </div>

      {/* Inline style for shimmer animation */}
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