import React, { useEffect, useState } from "react";

import ClusterService from "../services/ClusterService";
import { Layout } from "@/components/layout/Layout";

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const res = await ClusterService.getInstanceList();
        console.log(res);
        setInstances(res.instances);
      } catch (err: any) {
        setError(err?.response?.data?.error || "Failed to fetch instances");
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500 py-6">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 py-6">{error}</div>;
  }

  return (
    <Layout title="Instance List" subtitle="Complete Instance List">
      <div className="max-w-6xl mx-auto p-4">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          Kubernetes Instances
        </h2>

        {instances.length === 0 ? (
          <p className="text-gray-500">No instances found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="bg-white shadow-md rounded-xl p-4 border hover:shadow-lg transition-all"
              >
                <div className="mb-2">
                  <h3 className="text-lg font-bold text-blue-600">
                    {instance.name}
                  </h3>
                  <p className="text-sm text-gray-500">{instance.api_url}</p>
                </div>
                <p className="text-gray-700 mb-1">
                  <span className="font-medium">Client:</span>{" "}
                  {instance.client_name || "N/A"}
                </p>
                <p className="text-gray-700 mb-1">
                  <span className="font-medium">Status:</span>
                  <span
                    className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                      instance.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {instance.status}
                  </span>
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  <span className="font-medium">Created:</span>{" "}
                  {new Date(instance.created_at).toLocaleString()}
                </p>
                {instance.description && (
                  <p className="text-gray-500 text-sm mt-1 italic">
                    {instance.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default KubernetesInstanceList;
