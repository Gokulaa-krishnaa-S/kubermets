import React, { useState, useEffect } from 'react';
import { clusterCreationApi, ClusterData } from '../../services/clusterCreationApi';
import FormRenderer from './FormRenderer';
import formTemplate from '../../data/GCPClusterForm.template.json';
import { gcpRegions, gcpZonesByRegion } from '../../data/regions';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface GCPClusterFormProps {
  clusterId?: number;
  onSubmit?: (data: any, isUpdate: boolean) => void;
  onCancel?: () => void;
}

export default function GCPClusterForm({ clusterId, onSubmit, onCancel }: GCPClusterFormProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [computedTemplate, setComputedTemplate] = useState<any>(formTemplate);

  // Load existing cluster data if editing
  useEffect(() => {
    if (clusterId) {
      setIsEditing(true);
      loadClusterData(clusterId);
    }
  }, [clusterId]);

  const loadClusterData = async (id: number) => {
    try {
      setLoading(true);
      const response = await clusterCreationApi.getClusterById(id);
      setFormData(response.data.config || {});
    } catch (error) {
      console.error('Error loading cluster data:', error);
      setErrorMessage('Failed to load cluster data');
      setSubmitStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (data: any) => {
    setFormData(data);
    setSubmitStatus('idle');
    setErrorMessage('');
  };

  // Build dynamic options for region and zones based on selection
  useEffect(() => {
    const clone = JSON.parse(JSON.stringify(formTemplate));
    // inject regions
    const regionField = clone.fields.find((f: any) => f.name === 'gcpRegion');
    if (regionField) {
      regionField.options = gcpRegions;
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
      setLoading(true);
      setSubmitStatus('idle');
      setErrorMessage('');

      // Prepare cluster data
      const clusterData: ClusterData = {
        ...(clusterId && { id: clusterId }),
        user_id: 1, // This should come from auth context
        cluster_type: 'gcp',
        config: data,
      };

      const response = await clusterCreationApi.createOrUpdateCluster(clusterData);
      
      setSubmitStatus('success');
      
      if (onSubmit) {
        onSubmit(response.data, isEditing);
      }

      // Reset form after successful creation (not update)
      if (!isEditing) {
        setTimeout(() => {
          setFormData({});
          setSubmitStatus('idle');
        }, 2000);
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
      setSubmitStatus('error');
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

  return (
    <div className="max-w-4xl mx-auto">
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
          
          {/* Status Indicator */}
          {submitStatus === 'success' && (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                {isEditing ? 'Cluster updated successfully!' : 'Cluster created successfully!'}
              </span>
            </div>
          )}
          
          {submitStatus === 'error' && (
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Error occurred</span>
            </div>
          )}
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
      />
    </div>
  );
}
