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
              <button
                onClick={() => navigate(-1)}
              // className="flex items-center text-gray-700 hover:text-black"
              >
                <span className="">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M13.3332 8H2.6665M2.6665 8L6.6665 12M2.6665 8L6.6665 4" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    {/* <path d="M13.3332 8H2.6665M2.6665 8L6.6665 12M2.6665 8L6.6665 4" stroke="#8AB40A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /> */}
                  </svg>
                </span>
              </button>
              <span className='ml-2'>Cluster Creation</span>
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
