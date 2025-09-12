import { useNavigate } from 'react-router-dom';
import AzureClusterForm from '@/components/cluster-creation/AzureClusterForm';
import { toast } from 'sonner';

export default function AzureClusterPage() {
  const navigate = useNavigate();

  const handleSubmit = (data: any, isUpdate: boolean) => {
    toast.success(
      isUpdate ? 'Azure cluster updated successfully!' : 'Azure cluster created successfully!'
    );
    // Optionally navigate to cluster list or overview
    // navigate('/overview');
  };

  const handleCancel = () => {
    navigate('/overview');
  };

  return (
    <div className="w-full flex flex-col">
      <div className="flex-1 flex justify-center px-4 py-6">
        <div className="w-full max-w-4xl">
          <div className="mb-6">
            <nav className="flex text-sm text-muted-foreground">
              <span>Cluster Creation</span>
              <span className="mx-2">/</span>
              <span className="text-foreground">Azure AKS</span>
            </nav>
          </div>
          
          <AzureClusterForm 
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
