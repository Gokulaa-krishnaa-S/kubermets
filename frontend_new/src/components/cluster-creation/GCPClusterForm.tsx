import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clusterCreationApi, ClusterData } from '../../services/clusterCreationApi';
import FormRenderer from './FormRenderer';
import formTemplate from '../../data/GCPClusterForm.template.json';
import { gcpRegions, gcpZonesByRegion } from '../../data/regions';
import { AlertCircle, CheckCircle, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExistingGCPCluster from './ExistingGCPCluster';

interface GCPClusterFormProps {
  clusterId?: number;
  onSubmit?: (data: any, isUpdate: boolean) => void;
  onCancel?: () => void;
}

export default function GCPClusterForm({ clusterId, onSubmit, onCancel }: GCPClusterFormProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null; messages?: string[] }>({ type: null });
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [computedTemplate, setComputedTemplate] = useState<any>(formTemplate);
  const [showExistingCluster, setShowExistingCluster] = useState(false);

  // Load existing cluster data if editing
  useEffect(() => {
    if (clusterId) {
      setIsEditing(true);
      loadClusterData(clusterId);
    }
  }, [clusterId]);

  const loadClusterData = async (id: any) => {
    try {
      setLoading(true);
      const response = await clusterCreationApi.getClusterById(id);
      setFormData(response.data.config || {});
    } catch (error) {
      console.error('Error loading cluster data:', error);
      setErrorMessage('Failed to load cluster data');
      setSubmitStatus({ type: 'error', messages: ['Failed to load cluster data'] });
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (data: any) => {
    setFormData(data);
    setSubmitStatus({ type: null });
    setErrorMessage('');
  };

  // Build dynamic options for region and zones based on selection
  useEffect(() => {
    const clone = JSON.parse(JSON.stringify(formTemplate));
    // inject regions
    const regionField = clone.fields.find((f: any) => f.name === 'gcpRegion');
    if (regionField) {
      regionField.options = gcpRegions;
      regionField.className = "text-black";
    }
    // inject zones
    const zonesField = clone.fields.find((f: any) => f.name === 'availabilityZones');
    if (zonesField) {
      const region = formData.gcpRegion || gcpRegions[0]?.value;
      const zoneValues: string[] = gcpZonesByRegion[region] || [];
      zonesField.options = zoneValues.map((z) => ({ value: z, label: z }));
    }
    setComputedTemplate(clone);
  }, [formData.gcpRegion]);

  const handleSubmit = async (data: any) => {
    try {
      // setLoading(true);
      // setSubmitStatus({ type: null });
      // setErrorMessage('');

      // Prepare cluster data
      console.log('Form data to submit:', data);
      const clusterData: ClusterData = {
        ...(clusterId && { id: clusterId }),
        // user_id: 1, // This should come from auth context
        cluster_type: 'gcp',
        config: data,
      };
      console.log('Submitting cluster data******:', clusterData);

      const response = await clusterCreationApi.createOrUpdateCluster(clusterData);

      // Show success status
      setSubmitStatus({
        type: 'success',
        messages: [isEditing ? 'Cluster updated successfully!' : 'Cluster creation is in progress...']
      });

      // Auto-redirect to cluster metrics after 5 seconds
      setTimeout(() => {
        if (onSubmit) {
          onSubmit(response.data, isEditing);
        }

        // Redirect to cluster metrics page with cluster details
        const clusterId = response.data?.id;
        const clusterType = 'gcp';
        const creationType = 'new';

        navigate(`/metric/cluster?cluster_id=${clusterId}&cluster_type=${clusterType}&creation_type=${creationType}`);
      }, 5000);

      // Reset form after successful creation (not update)
      if (!isEditing) {
        setTimeout(() => {
          setFormData({});
          setSubmitStatus({ type: null });
        }, 5500);
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      const errorMsg = error instanceof Error ? error.message : 'Cluster creation failed';
      setErrorMessage(errorMsg);

      // Show error status
      setSubmitStatus({
        type: 'error',
        messages: [errorMsg]
      });

    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditing && !formData.clusterName) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading cluster configuration...</p>
        </div>
      </div>
    );
  }

  if (showExistingCluster) {
    return (
      <ExistingGCPCluster
        onSubmit={(data) => {
          console.log('Existing cluster submitted:', data);
          setShowExistingCluster(false);
        }}
        onCancel={() => setShowExistingCluster(false)}
      />
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {isEditing ? 'Edit GCP Cluster' : 'Create GCP Cluster'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure your Google Kubernetes Engine cluster settings
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Add Existing Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowExistingCluster(true)}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Attach Existing Cluster
            </Button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Form Content */}
      <FormRenderer
        template={computedTemplate}
        data={formData}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        loading={loading}
        submitButtonText={isEditing ? 'Update Cluster' : 'Create Cluster'}
        onCancel={onCancel}
        status={submitStatus}
      />
    </div>
  );
}
