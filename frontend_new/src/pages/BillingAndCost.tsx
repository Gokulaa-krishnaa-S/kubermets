import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign } from "lucide-react";
import { Layout } from "@/components/layout/Layout";

// Sample billing/cost data (from k8newDashboard)
const billingData = [
  { month: "Jan", cost: 3800 },
  { month: "Feb", cost: 4100 },
  { month: "Mar", cost: 3950 },
  { month: "Apr", cost: 4240 },
  { month: "May", cost: 4120 },
  { month: "Jun", cost: 4300 },
];

const costData = [
  { namespace: "production", cost: 2450, waste: 15 },
  { namespace: "staging", cost: 890, waste: 25 },
  { namespace: "development", cost: 560, waste: 35 },
  { namespace: "monitoring", cost: 340, waste: 8 },
];

export function BillingAndCost() {
  return (
    <Layout
      title="Billing & Cost"
      subtitle="CPU, memory, restarts, state, and health probe monitoring"
    >
      <Card>
        <CardHeader>
          <CardTitle>Billing & Cost</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="h-6 w-6 text-green-600" />
              <span className="text-lg font-semibold text-gray-900">
                Monthly Billing Overview
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={billingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cost" fill="#3B82F6" name="Monthly Cost ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Resource Waste Analysis
                </h3>
                <div className="space-y-4">
                  {costData.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {item.namespace}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Monthly cost: ${item.cost}
                        </p>
                      </div>
                      <div className="text-right">
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.waste > 30
                              ? "bg-red-100 text-red-800"
                              : item.waste > 20
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {item.waste}% waste
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
    </Layout>
  );
}
