import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  Server, 
  Activity, 
  BarChart3, 
  DollarSign, 
  Gauge, 
  Settings, 
  Monitor,
  Shield,
  Cpu,
  Clock,
  ChevronRight
} from "lucide-react";

export const ClusterLayoutLoader = ({ 
  title = "Cluster Metrics", 
  subtitle = "Loading comprehensive monitoring and resource analytics..." 
}) => {
  return (
    <div className="p-4 lg:p-6">
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

      <div className="space-y-6">
        {/* Enhanced Metric Cards Grid - 6 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-8 bg-gray-200 rounded animate-pulse w-16"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>
          ))}
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Clusters Card */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 relative overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-40 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Cluster Cards Skeleton */}
                  {[1, 2, 3].map((clusterIndex) => (
                    <div
                      key={clusterIndex}
                      className="group p-6 border-2 border-gray-100 rounded-xl bg-white"
                    >
                      {/* Cluster Header */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gray-200 rounded-xl animate-pulse">
                            <div className="w-6 h-6 bg-gray-300 rounded animate-pulse"></div>
                          </div>
                          <div>
                            <div className="h-5 bg-gray-200 rounded animate-pulse w-32 mb-2"></div>
                            <div className="flex items-center gap-2">
                              <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
                              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                              <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-6 bg-gray-200 rounded-full animate-pulse w-16"></div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      {/* Metrics Grid - 4 columns */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {[1, 2, 3, 4].map((metricIndex) => (
                          <div key={metricIndex} className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
                            <div className="h-6 bg-gray-200 rounded animate-pulse w-12 mx-auto mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-16 mx-auto"></div>
                          </div>
                        ))}
                      </div>

                      {/* Resource Usage Bars */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2].map((barIndex) => (
                          <div key={barIndex} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-gray-400" />
                                <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                              </div>
                              <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div className="h-3 bg-gray-300 rounded-full animate-pulse w-1/2"></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-4">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
                        </div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>

            {/* Resource Utilization Chart */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg animate-pulse">
                    <BarChart3 className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-48 mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-40"></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {[1, 2, 3, 4].map((metric) => (
                    <div key={metric} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div className="h-4 bg-gray-300 rounded-full animate-pulse" style={{width: '60%'}}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>

            {/* Cost Distribution Donut Chart */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gray-200 rounded-lg animate-pulse">
                    <DollarSign className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-52 mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-64"></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-14">
                <div className="flex justify-center">
                  <div className="w-64 h-64 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            {/* Efficiency Distribution */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg animate-pulse">
                    <Gauge className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="h-5 bg-gray-200 rounded animate-pulse w-36"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { bg: "bg-green-50", dot: "bg-green-500" },
                    { bg: "bg-yellow-50", dot: "bg-yellow-500" },
                    { bg: "bg-red-50", dot: "bg-red-500" }
                  ].map((item, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 ${item.bg} rounded-lg`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 ${item.dot} rounded-full animate-pulse`}></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded animate-pulse w-8"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>

            {/* Cost Breakdown */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg animate-pulse">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="h-5 bg-gray-200 rounded animate-pulse w-28"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
                        <div className="text-right space-y-1">
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
                          <div className="h-3 bg-gray-200 rounded animate-pulse w-8"></div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="h-2 bg-gray-300 rounded-full animate-pulse" style={{width: `${40 + (item * 15)}%`}}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg animate-pulse">
                    <Settings className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="h-5 bg-gray-200 rounded animate-pulse w-28"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { icon: Monitor, bg: "bg-blue-100" },
                    { icon: Shield, bg: "bg-green-100" },
                    { icon: BarChart3, bg: "bg-purple-100" }
                  ].map((action, index) => (
                    <div key={index} className="w-full flex items-center gap-3 p-3 rounded-lg border border-transparent">
                      <div className={`p-2 ${action.bg} rounded-lg animate-pulse`}>
                        <action.icon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded animate-pulse w-20"></div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>

            {/* System Health */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg animate-pulse">
                    <Activity className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="h-5 bg-gray-200 rounded animate-pulse w-28"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { bg: "bg-green-50", dot: "bg-green-500" },
                    { bg: "bg-green-50", dot: "bg-green-500" },
                    { bg: "bg-blue-50", dot: "bg-blue-500" }
                  ].map((health, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 ${health.bg} rounded-lg`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 ${health.dot} rounded-full animate-pulse`}></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            </Card>
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
          <span className="text-sm font-medium text-gray-700">Loading cluster metrics...</span>
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