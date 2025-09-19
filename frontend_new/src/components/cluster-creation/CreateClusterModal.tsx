import React, { useEffect } from 'react';
import { X, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useNavigate } from 'react-router-dom';

interface CreateClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ClusterProvider = 'gcp' | 'aws' | 'azure' | 'sify';

const clusterOptions = [
  {
    id: 'gcp' as const,
    title: 'GCP GKE',
    description: 'Google Kubernetes Engine',
    icon: '/environment-ingress/gcp.jpg',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
  },
  {
    id: 'aws' as const,
    title: 'AWS EKS',
    description: 'Amazon Elastic Kubernetes Service',
    icon: '/environment-ingress/aws.jpg',
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100'
  },
  {
    id: 'azure' as const,
    title: 'Azure AKS',
    description: 'Azure Kubernetes Service',
    icon: '/environment-ingress/azure.jpg',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
  },
  {
    id: 'sify' as const,
    title: 'Sify Cloud',
    description: 'Sify Cloud Platform',
    icon: '/environment-ingress/sify.jpg',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
  }
];

export function CreateClusterModal({ isOpen, onClose }: CreateClusterModalProps) {
  const navigate = useNavigate();

  const handleProviderSelect = (provider: ClusterProvider) => {
    // Navigate to the cluster creation route for the selected provider
    navigate(`/cluster-creation/${provider}`);
    // Close the modal after navigation
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed right-0 top-0 h-full w-full max-w-4xl bg-background border-l shadow-2xl z-50 transform transition-transform duration-300 ease-in-out translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium"></span>
            </button>

            <h2 className="text-2xl font-bold">Choose a Cloud Provider</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {clusterOptions.map((option) => (
              <Card
                key={option.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${option.color}`}
                onClick={() => handleProviderSelect(option.id)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden">
                      <img
                        src={option.icon}
                        alt={`${option.title} icon`}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `<div class="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs font-bold text-gray-500">${option.title.charAt(0)}</div>`;
                        }}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{option.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {option.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Click to configure and deploy a new Kubernetes cluster on {option.title}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
