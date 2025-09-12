import { useState } from 'react';
import { clusterCreationApi, ClusterData } from '../../services/clusterCreationApi';
import FormRenderer from './FormRenderer';
import template from '../../data/AWSClusterForm.template.json';

interface Props {
  clusterId?: number;
  onSubmit?: (data: any, isUpdate: boolean) => void;
  onCancel?: () => void;
}

export default function AWSClusterForm({ clusterId, onSubmit, onCancel }: Props) {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: any) => {
    setLoading(true);
    try {
      const payload: ClusterData = { 
        ...(clusterId ? { id: clusterId } : {}), 
        user_id: 1, 
        cluster_type: 'aws', 
        config: formData 
      };
      const resp = await clusterCreationApi.createOrUpdateCluster(payload);
      onSubmit?.(resp.data, Boolean(clusterId));
    } catch (error) {
      console.error('Error submitting AWS cluster form:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">
          {clusterId ? 'Edit AWS EKS Cluster' : 'Create AWS EKS Cluster'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your Amazon Elastic Kubernetes Service cluster settings
        </p>
      </div>
      <FormRenderer 
        template={template as any} 
        data={data} 
        onChange={setData} 
        onSubmit={handleSubmit} 
        loading={loading} 
        submitButtonText={clusterId ? 'Update Cluster' : 'Create Cluster'} 
        onCancel={onCancel} 
      />
    </div>
  );
}
