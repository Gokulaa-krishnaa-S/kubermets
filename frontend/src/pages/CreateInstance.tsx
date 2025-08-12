import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import ClusterService from "@/services/ClusterService";

interface InstanceFormData {
  name: string;
  description: string;
  api_url: string;
  client_name: string;
  username: string;
  password: string;
}

interface InstanceFormProps {
  mode: "create" | "edit";
  initialData?: any;
  onBack: () => void;
  onInstanceSaved: () => void;
}

const InstanceForm: React.FC<InstanceFormProps> = ({
  mode,
  initialData,
  onBack,
  onInstanceSaved,
}) => {
  const [formData, setFormData] = useState<InstanceFormData>({
    name: "",
    description: "",
    api_url: "",
    client_name: "",
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pre-fill for edit mode
  useEffect(() => {
    if (mode === "edit" && initialData) {
      const { name, description, api_url, client_name, username, password } =
        initialData;
      console.log(client_name, "---------------");
      setFormData({
        name,
        description,
        api_url,
        client_name,
        username,
        password,
      });
    }
  }, [mode, initialData]);
  const providers = ["GCP", "AWS", "SIFY", "Cloudflare"];
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError("Instance name is required");
      return false;
    }
    if (!formData.api_url.trim()) {
      setError("API URL is required");
      return false;
    }
    try {
      new URL(formData.api_url);
    } catch {
      setError("Please enter a valid API URL");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);

    try {
      let result;

      if (mode === "create") {
        result = await ClusterService.createInstance(formData);
      } else {
        if (!initialData?.id) {
          throw new Error("Instance ID is missing for update");
        }
        result = await ClusterService.updateInstance(initialData.id, formData);
      }

      setSuccess(true);
      setTimeout(() => {
        onInstanceSaved();
        onBack();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to save instance");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Layout
        title={mode === "create" ? "Create Instance" : "Edit Instance"}
        subtitle={
          mode === "create"
            ? "Create a new Kubernetes instance"
            : "Update Kubernetes instance details"
        }
      >
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              {mode === "create"
                ? "Instance Created Successfully!"
                : "Instance Updated Successfully!"}
            </h3>
            <p className="text-green-600">
              Redirecting back to instance list...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow-lg rounded-xl p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            type="button"
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mr-4"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === "create" ? "Create New Instance" : "Edit Instance"}
          </h2>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* form fields */}
        <div className="space-y-6">
          {/* Instance name & client name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                customer name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="client_name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Provider Name
              </label>
              <select
                id="client_name"
                name="client_name"
                value={formData.client_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a provider</option>
                {providers.map((client, index) => (
                  <option key={index} value={client}>
                    {client}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* API URL */}
          <div>
            <label
              htmlFor="api_url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              API URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              id="api_url"
              name="api_url"
              value={formData.api_url}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {mode === "create" ? "Create" : "Update"} Instance
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstanceForm;
