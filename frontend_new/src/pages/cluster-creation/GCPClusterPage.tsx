import { useNavigate } from 'react-router-dom';
import GCPClusterForm from '@/components/cluster-creation/GCPClusterForm';
import { toast } from 'sonner';

export default function GCPClusterPage() {
  const navigate = useNavigate();

  const handleSubmit = (data: any, isUpdate: boolean) => {
    toast.success(
      isUpdate ? 'GCP cluster updated successfully!' : 'GCP cluster creation is in progress!'
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
              <span className="text-foreground">GCP GKE</span>
            </nav>
          </div>

          <GCPClusterForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
