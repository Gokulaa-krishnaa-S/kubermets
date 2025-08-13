import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Plus, RefreshCcw } from "lucide-react";
import InstanceForm from "./CreateInstance";
import ClusterService from "@/services/ClusterService";
import { SettingsMetricsLoader } from "@/components/loader/settingsloader";

interface KubernetesInstance {
  id: number;
  name: string;
  description: string;
  api_url: string;
  client_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const KubernetesInstanceList: React.FC = () => {
  const [instances, setInstances] = useState<KubernetesInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingInstance, setEditingInstance] =
    useState<KubernetesInstance | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const fetchInstances = async () => {
    try {
      setRefreshing(true);
      const res = await ClusterService.getInstanceList();
      setInstances(res?.instances || []);
    } catch (err: any) {
      console.error("Error fetching instances:", err);
      setError(err?.response?.data?.error || "Failed to fetch instances");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    setIsInitialLoading(true);

    fetchInstances();
  }, []);

  const handleCreate = () => {
    setEditingInstance(null);
    setShowForm(true);
  };

  const handleEdit = (instance: KubernetesInstance) => {
    setEditingInstance(instance);
    setShowForm(true);
  };

  const handleBack = () => {
    setShowForm(false);
    setEditingInstance(null);
  };
  if (isInitialLoading) {
    return (
      <SettingsMetricsLoader
        title="Settings"
        subtitle="Loading comprehensive monitoring and resource analytics..."
      />
    );
  }
  if (showForm) {
    return (
      <InstanceForm
        mode={editingInstance ? "edit" : "create"}
        initialData={editingInstance || undefined}
        onBack={handleBack}
        onInstanceSaved={fetchInstances}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-500">Loading instances...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={fetchInstances}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Unified title + icon + buttons row */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-gray-700" />
          <span className="text-xl font-semibold">
            Manage clusters <b>({instances.length})</b>
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchInstances}
            disabled={refreshing}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCcw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="ml-2 hidden sm:block">Refresh</span>
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span className="ml-2 hidden sm:block">Add Cluster</span>
          </button>
        </div>
      </div>

      {instances.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            No instances found
          </h3>
          <p className="text-gray-500 mb-6">
            Get started by creating your first Kubernetes instance
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Instance
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="bg-white shadow-md rounded-xl p-6 border hover:shadow-lg transition-all duration-200"
            >
              <div className="mb-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-blue-600 truncate">
                    {instance.name}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      instance.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {instance.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 break-all">
                  {instance.api_url}
                </p>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-600 w-16">
                    Client:
                  </span>
                  <span className="text-sm text-gray-800">
                    {instance.client_name || "N/A"}
                  </span>
                </div>
                {instance.description && (
                  <div className="flex items-start">
                    <span className="text-sm font-medium text-gray-600 w-16 flex-shrink-0">
                      About:
                    </span>
                    <span className="text-sm text-gray-700 italic">
                      {instance.description}
                    </span>
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-gray-100 text-xs text-gray-500">
                Created: {new Date(instance.created_at).toLocaleDateString()}
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => handleEdit(instance)}
                  className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KubernetesInstanceList;
