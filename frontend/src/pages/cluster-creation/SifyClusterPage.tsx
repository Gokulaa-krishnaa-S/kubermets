import { useNavigate } from 'react-router-dom';
import SIFYClusterForm from '@/components/cluster-creation/SIFYClusterForm';
import { toast } from 'sonner';

export default function SifyClusterPage() {
  const navigate = useNavigate();

  const handleSubmit = (data: any, isUpdate: boolean) => {
    toast.success(
      isUpdate ? 'Sify cluster updated successfully!' : 'Sify cluster created successfully!'
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
              <span className="text-foreground">Sify</span>
            </nav>
          </div>
          
          <SIFYClusterForm 
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
