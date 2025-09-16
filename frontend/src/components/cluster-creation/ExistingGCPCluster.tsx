import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FormRenderer from "./FormRenderer";
import existingTemplate from "../../data/ExistingGCPCluster.template.json";
import {
  clusterCreationApi,
  fetchClusterDetails,
} from "../../services/clusterCreationApi";
import { gcpRegions, gcpZonesByRegion } from "../../data/regions";

interface ExistingGCPClusterProps {
  onSubmit?: (data: any) => void;
  onCancel: () => void;
  editClusterId?: number;
  initialData?: any;
}

export default function ExistingGCPCluster({
  onSubmit,
  onCancel,
  editClusterId,
  initialData,
}: ExistingGCPClusterProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [computedTemplate, setComputedTemplate] =
    useState<any>(existingTemplate);
  const [progressModal, setProgressModal] = useState<{
    isOpen: boolean;
    type: "progress" | "success" | "error";
    message: string;
  }>({ isOpen: false, type: "progress", message: "" });

  // Load initial data in edit mode
  useEffect(() => {
    if (editClusterId && initialData) {
      const config = initialData.config || {};
      const credentials = config.credentials || {};
      const general = config.general || {};
      const location = config.location || {};
      const cluster = config.cluster || {};

      setFormData({
        credentials: {
          credential_name: credentials.credential_name || "",
          service_account_json: credentials.service_account_json || null,
        },
        general: {
          googleProjectId: general.googleProjectId || "",
          description: general.description || "",
        },
        location: {
          region: location.region || "",
          zone: location.zone || "",
        },
        cluster: {
          clusterName: cluster.clusterName || "",
        },
      });
    }
  }, [editClusterId, initialData]);

  // Update template with dynamic regions and zones (full lists, no dependency)
  useEffect(() => {
    const clone = JSON.parse(JSON.stringify(existingTemplate));
    // Find the location group and inject into its child fields
    const locationGroup = clone.fields.find(
      (f: any) => f.name === "location" && f.type === "group"
    );
    if (locationGroup && Array.isArray(locationGroup.fields)) {
      const regionField = locationGroup.fields.find(
        (f: any) => f.name === "region"
      );
      if (regionField) {
        regionField.options = gcpRegions;
      }
      const zoneField = locationGroup.fields.find(
        (f: any) => f.name === "zone"
      );
      if (zoneField) {
        const allZones: string[] = Object.values(gcpZonesByRegion).flat();
        zoneField.options = allZones.map((z) => ({ value: z, label: z }));
      }
    }
    setComputedTemplate(clone);
  }, []);

  const handleFormChange = (data: any) => {
    setFormData(data);
  };

  const handleSubmit = async (data: any) => {
    try {
      setLoading(true);

      // Show progress modal
      setProgressModal({
        isOpen: true,
        type: "progress",
        message: "Validating and connecting to cluster...",
      });

      // Determine final region/zone without interdependency
      const locationGroup = data.location || {};
      let finalRegion =
        (locationGroup.region as string | undefined) || undefined;
      let finalZone = (locationGroup.zone as string | undefined) || undefined;

      // Validation: require either region or zone
      if (!finalRegion && !finalZone) {
        setProgressModal({
          isOpen: true,
          type: "error",
          message: "Choose region or zone",
        });
        setTimeout(() => {
          setProgressModal({ isOpen: false, type: "progress", message: "" });
        }, 2000);
        return;
      }

      // If only zone chosen, derive region from zone (e.g., asia-south1-a -> asia-south1)
      if (!finalRegion && finalZone) {
        const parts = finalZone.split("-");
        if (parts.length >= 3) {
          finalRegion = parts.slice(0, 2).join("-");
        }
      }

      // Validate connectivity before saving
      // try {
      //   await fetchClusterDetails(
      //     data.cluster?.clusterName,
      //     finalZone || (finalRegion as string),
      //     { isImported: 1, serviceAccountJson: data.credentials?.service_account_json }
      //   );
      //   // Show success for connection
      //   setProgressModal({
      //     isOpen: true,
      //     type: 'success',
      //     message: 'Cluster connected successfully'
      //   });
      //   await new Promise((resolve) => setTimeout(resolve, 2000));
      //   // Switch back to progress for saving
      //   setProgressModal({
      //     isOpen: true,
      //     type: 'progress',
      //     message: 'Importing existing cluster...'
      //   });
      // } catch (connectionError) {
      //   console.error('Connection validation failed:', connectionError);
      //   const connectionMsg = connectionError instanceof Error ? connectionError.message : 'Failed to connect to cluster';
      //   setProgressModal({
      //     isOpen: true,
      //     type: 'error',
      //     message: connectionMsg
      //   });
      //   setTimeout(() => {
      //     setProgressModal({ isOpen: false, type: 'progress', message: '' });
      //   }, 2000);
      //   return;
      // }

      // Structure the data according to the backend expectations
      // Backend expects required fields at top level, config contains the grouped structure
      const structuredData = {
        credentials: {
          credential_name: data.credentials?.credential_name,
          service_account_json: data.credentials?.service_account_json,
        },
        general: {
          googleProjectId: data.general?.googleProjectId,
          description: data.general?.description,
        },
        location: {
          region: finalRegion,
          zone: finalZone,
        },
        cluster: {
          clusterName: data.cluster?.clusterName,
        },
      };

      // Create the payload with required fields at top level
      const payload = {
        user_id: 1,
        cluster_type: "gcp",
        config: structuredData,
        // Required fields at top level for backend validation
        service_account_json: data.credentials?.service_account_json,
        googleProjectId: data.general?.googleProjectId,
        clusterName: data.cluster?.clusterName,
      };

      // Debug: Log the payload to see what's being sent
      console.log("Payload being sent:", JSON.stringify(payload, null, 2));
      console.log("Required fields check:", {
        service_account_json: !!data.credentials?.service_account_json,
        googleProjectId: !!data.general?.googleProjectId,
        clusterName: !!data.cluster?.clusterName,
      });

      let response: any;
      if (editClusterId) {
        response = await clusterCreationApi.updateExistingCluster(
          editClusterId,
          payload
        );
      } else {
        response = await clusterCreationApi.createExistingCluster(payload);
      }

      // Show success modal
      setProgressModal({
        isOpen: true,
        type: "success",
        message: editClusterId
          ? "Existing cluster updated successfully!"
          : "Existing cluster imported successfully!",
      });

      // Auto-close modal after 2 seconds
      setTimeout(() => {
        setProgressModal({ isOpen: false, type: "progress", message: "" });
        if (onSubmit) {
          onSubmit(response.data);
        }

        // Redirect to cluster metrics page with cluster details
        const clusterId = response.data?.id;
        const clusterType = "gcp";
        const creationType = "new";

        navigate(
          `/metric/cluster?cluster_id=${clusterId}&cluster_type=${clusterType}&creation_type=${creationType}`
        );
      }, 2000);
    } catch (error) {
      console.error("Error importing existing cluster:", error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to import cluster. Please try again.";

      // Show error modal
      setProgressModal({
        isOpen: true,
        type: "error",
        message: errorMsg,
      });

      // Auto-close modal after 2 seconds
      setTimeout(() => {
        setProgressModal({ isOpen: false, type: "progress", message: "" });
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Modal */}
      {progressModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              {progressModal.type === "progress" && (
                <Loader2 className="w-6 h-6 animate-spin text-[#9db309]" />
              )}
              {progressModal.type === "success" && (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}
              {progressModal.type === "error" && (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
              <h3 className="text-lg font-semibold">
                {progressModal.type === "progress"
                  ? "Processing..."
                  : progressModal.type === "success"
                  ? "Success!"
                  : "Error!"}
              </h3>
            </div>
            <p className="text-gray-600">{progressModal.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {editClusterId
                ? "Edit Existing GCP Cluster"
                : "Import Existing GCP Cluster"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Import your existing Google Kubernetes Engine cluster
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Form Content */}
      <FormRenderer
        template={computedTemplate}
        data={formData}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        loading={loading}
        submitButtonText={editClusterId ? "Update Cluster" : "Import Cluster"}
        onCancel={onCancel}
      />
    </div>
  );
}
