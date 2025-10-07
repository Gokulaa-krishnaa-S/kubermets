import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clusterCreationApi, ClusterData } from '../../services/clusterCreationApi';
import FormRenderer from './FormRenderer';
import formTemplate from '../../data/GCPClusterForm.template.json';
import { gcpRegions, gcpZonesByRegion } from '../../data/regions';
import { AlertCircle, CheckCircle, Loader2, FileText, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExistingGCPCluster from './ExistingGCPCluster';
import * as yaml from 'js-yaml';

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
  const [jsonUploadError, setJsonUploadError] = useState('');

  // Create sample template data
  const createSampleTemplate = () => {
    return {
      gcpRegion: 'us-central1',
      gcpProjectId: 'my-project-123',
      clusterName: 'my-gke-cluster',
      kubernetesVersion: '1.31',
      ipv4CidrBlock: '172.16.0.0/28',
      availabilityZones: ['us-central1-a', 'us-central1-b'],
      networkConfig: 'create-new',
      ipv4CidrPrivateSubnet: '10.0.1.0/24',
      ipv4CidrPods: '10.1.0.0/16',
      ipv4CidrServices: '10.2.0.0/16',
      podRangeName: 'pods-range',
      serviceRangeName: 'services-range',
      networkTags: ['gke-cluster', 'production'],
      credentialName: 'my-gcp-credential',
      bucketConfig: {
        gcsBucketName: 'my-terraform-state-bucket',
        prefixPath: 'clusters/gcp'
      },
      platformFeatures: ['blobStorage', 'registry'],
      namespaceEnabled: true,
      namespace: {
        name: 'my-namespace',
        collaborators: [],
        repository: {},
        labels: {},
        annotations: {}
      },
      cpuPools: [
        {
          cpu_np_name: 'cpu-pool-1',
          cpu_np_capacity_type: 'on-demand',
          cpu_np_instance_type: 'e2-standard-4',
          cpu_np_min_node_count: 1,
          cpu_np_max_node_count: 3
        }
      ],
      gpuPools: [
        {
          gpu_np_name: 'gpu-pool-1',
          gpu_np_capacity_type: 'on-demand',
          gpu_np_gpu_type: 'nvidia-l4',
          gpu_np_machine_type: 'g2-standard-4',
          gpu_np_min_node_count: 0,
          gpu_np_max_node_count: 2
        }
      ]
    };
  };

  const downloadTemplate = (format: 'json' | 'yaml') => {
    const sampleData = createSampleTemplate();
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(sampleData, null, 2);
      filename = 'gcp-cluster-template.json';
      mimeType = 'application/json';
    } else {
      content = yaml.dump(sampleData, { indent: 2 });
      filename = 'gcp-cluster-template.yaml';
      mimeType = 'text/yaml';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
    setJsonUploadError('');
  };

  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isJsonFile = file.type === 'application/json' || file.name.endsWith('.json');
    const isYamlFile = file.type === 'text/yaml' || file.type === 'application/x-yaml' ||
      file.name.endsWith('.yaml') || file.name.endsWith('.yml');

    if (!isJsonFile && !isYamlFile) {
      setJsonUploadError('Please select a valid JSON or YAML file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        let parsedData: any;

        if (isJsonFile) {
          parsedData = JSON.parse(fileContent);
        } else if (isYamlFile) {
          // Use js-yaml library for proper YAML parsing
          parsedData = yaml.load(fileContent) as any;
        }

        // Validate that the file contains expected GCP cluster fields
        const expectedFields = [
          'gcpRegion', 'gcpProjectId', 'clusterName', 'kubernetesVersion',
          'ipv4CidrBlock', 'availabilityZones', 'networkConfig',
          'ipv4CidrPrivateSubnet', 'ipv4CidrPods', 'ipv4CidrServices',
          'podRangeName', 'serviceRangeName', 'networkTags',
          'networkId', 'subnetId', 'credentialName', 'credential_name',
          'gcsBucketName', 'prefixPath', 'platformFeatures', 'namespaceEnabled',
          'cpuPools', 'gpuPools', 'service_account_json',
          // CPU Pool fields
          'cpu_np_name', 'cpu_np_capacity_type', 'cpu_np_instance_type',
          'cpu_np_min_node_count', 'cpu_np_max_node_count',
          // GPU Pool fields
          'gpu_np_name', 'gpu_np_capacity_type', 'gpu_np_gpu_type',
          'gpu_np_machine_type', 'gpu_np_min_node_count', 'gpu_np_max_node_count'
        ];

        const hasValidFields = expectedFields.some(field =>
          parsedData.hasOwnProperty(field) ||
          (parsedData.credentials && parsedData.credentials.hasOwnProperty(field)) ||
          (parsedData.bucketConfig && parsedData.bucketConfig.hasOwnProperty(field)) ||
          (parsedData.namespace && parsedData.namespace.hasOwnProperty(field))
        );

        if (!hasValidFields) {
          setJsonUploadError('Invalid config format. Please ensure the file contains GCP cluster configuration fields.');
          return;
        }

        // Merge the uploaded data with existing form data
        const mergedData = { ...formData, ...parsedData };
        setFormData(mergedData);
        setJsonUploadError('');

        // Show success message
        setSubmitStatus({
          type: 'success',
          messages: ['Configuration loaded successfully from config file!']
        });

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSubmitStatus({ type: null });
        }, 3000);

      } catch (error) {
        setJsonUploadError('Invalid config format. Please check the file and try again.');
        console.error('Config parsing error:', error);
      }
    };

    reader.onerror = () => {
      setJsonUploadError('Error reading the file. Please try again.');
    };

    reader.readAsText(file);

    // Reset the input
    event.target.value = '';
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

    const credentialField = clone.fields.find((f: any) => f.name === 'credentialName');
    if (credentialField) {
      credentialField.required = !showExistingCluster;
      // required in create flow, optional in attach flow
    }
    setComputedTemplate(clone);
  }, [formData.gcpRegion, showExistingCluster]);

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
        // const jobId = response.data?.job_id;

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
            {/* Upload Config Button */}
            <div className="relative">
              <input
                type="file"
                accept=".json,.yaml,.yml,application/json,text/yaml,application/x-yaml"
                onChange={handleJsonUpload}
                className="absolute  w-full h-full opacity-0 cursor-pointer"
                id="json-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2"
                asChild
              >
                <label htmlFor="json-upload" className="cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Fill Form from template
                </label>
              </Button>
            </div>

            {/* Download Template Buttons */}


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

        {/* Download Template Section */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Download Sample Templates</p>
              <p className="text-xs text-muted-foreground">Get started with pre-configured templates</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => downloadTemplate('json')}
                className="flex items-center gap-1 h-8 px-2 text-xs"
              >
                <Download className="w-3 h-3" />
                JSON
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => downloadTemplate('yaml')}
                className="flex items-center gap-1 h-8 px-2 text-xs"
              >
                <Download className="w-3 h-3" />
                YAML
              </Button>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {jsonUploadError && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{jsonUploadError}</p>
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
