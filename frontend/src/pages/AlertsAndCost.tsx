import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Eye,
  Bell,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";

// Sample data from k8newDashboard
const alertsData = [
  { severity: "Critical", count: 3, color: "#EF4444" },
  { severity: "Warning", count: 8, color: "#F59E0B" },
  { severity: "Info", count: 12, color: "#3B82F6" },
];

const costData = [
  { namespace: "production", cost: 2450, waste: 15 },
  { namespace: "staging", cost: 890, waste: 25 },
  { namespace: "development", cost: 560, waste: 35 },
  { namespace: "monitoring", cost: 340, waste: 8 },
];

export function AlertsAndCost() {
  return (
    <Layout
      title="Alerts & Cost"
      subtitle="CPU, memory, restarts, state, and health probe monitoring"
    >
      <div className="space-y-8">
        {/* Alerts & Events Section */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts & Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Alert Distribution
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={alertsData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="count"
                    >
                      {alertsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Recent Alerts
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center p-3 border-l-4 border-red-500 bg-red-50 rounded">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        Node worker-03 not ready
                      </p>
                      <p className="text-xs text-red-600">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center p-3 border-l-4 border-orange-500 bg-orange-50 rounded">
                    <Eye className="h-5 w-5 text-orange-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        High memory usage in production
                      </p>
                      <p className="text-xs text-orange-600">15 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center p-3 border-l-4 border-blue-500 bg-blue-50 rounded">
                    <Bell className="h-5 w-5 text-blue-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Pod web-app-xyz scheduled
                      </p>
                      <p className="text-xs text-blue-600">1 hour ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

       
      </div>
    </Layout>
  );
}
