import { useNavigate } from 'react-router-dom';
import AWSClusterForm from '@/components/cluster-creation/AWSClusterForm';
import { toast } from 'sonner';

export default function AWSClusterPage() {
  const navigate = useNavigate();

  const handleSubmit = (data: any, isUpdate: boolean) => {
    toast.success(
      isUpdate ? 'AWS cluster updated successfully!' : 'AWS cluster created successfully!'
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
              <span className="text-foreground">AWS EKS</span>
            </nav>
          </div>
          
          <AWSClusterForm 
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
