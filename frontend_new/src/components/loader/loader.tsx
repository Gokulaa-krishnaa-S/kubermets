// loader.tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Server, Box, Layers, Activity } from "lucide-react";

export const ResponsiveLoader = ({ 
  title = "Overview", 
  subtitle = "Loading Kubernetes cost metrics..." 
}) => {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col space-y-2">
          <div className="h-8 bg-gray-200 rounded-lg animate-pulse w-48"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-96 max-w-full"></div>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
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

      {/* Main Content Loading */}
      <div className="space-y-6">
        {/* Introduction Card Skeleton */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-80 mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
            </div>
          </CardContent>
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
        </Card>

        {/* Metric Categories Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: <Server className="w-6 h-6" />, color: "bg-blue-100" },
            { icon: <Box className="w-6 h-6" />, color: "bg-green-100" },
            { icon: <Layers className="w-6 h-6" />, color: "bg-purple-100" }
          ].map((item, index) => (
            <Card key={index} className="relative overflow-hidden border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg ${item.color}`}>
                    <div className="text-gray-400">
                      {item.icon}
                    </div>
                  </div>
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-32"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                </div>
                <div className="space-y-2 mt-4">
                  {[1, 2, 3].map((metricIndex) => (
                    <div key={metricIndex} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                      <div className="h-3 bg-gray-200 rounded animate-pulse flex-1"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>
          ))}
        </div>

        {/* Cost Breakdown Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded animate-pulse w-40 mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>
          ))}
        </div>

        {/* Floating Activity Indicator */}
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex items-center gap-3 bg-white shadow-lg rounded-full px-4 py-3 border">
            <div className="relative">
              <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full animate-ping"></div>
            </div>
            <span className="text-sm font-medium text-gray-700">Loading metrics...</span>
          </div>
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
