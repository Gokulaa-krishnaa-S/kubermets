import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff, AlertCircle } from 'lucide-react';

// Loading Banner Component
interface LoadingBannerProps {
  message: string;
}

export const LoadingBanner: React.FC<LoadingBannerProps> = ({ message }) => (
  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-blue-800 text-sm">{message}</span>
    </div>
  </div>
);

interface ConnectionStatusBannerProps {
  connectionStatus: 'connected' | 'disconnected';
  error?: string | null;
  retryAttempts?: number;
  maxRetries?: number;
  isLoadingData?: boolean;
  isRefreshing?: boolean;
  onRetry: () => void;
}

export const ConnectionStatusBanner: React.FC<ConnectionStatusBannerProps> = ({
  connectionStatus,
  error,
  retryAttempts = 0,
  maxRetries = 3,
  isLoadingData = false,
  isRefreshing = false,
  onRetry
}) => {
  // Don't show banner if connection is good and no error
  if (connectionStatus === 'connected' && !error) return null;

  const getStatusConfig = () => {
    if (connectionStatus === 'disconnected') {
      return {
        bgClass: 'bg-red-50 border-red-200',
        textClass: 'text-red-800',
        iconClass: 'text-red-600',
        icon: WifiOff,
        title: 'Server Down',
        subtitle: 'Connection Lost'
      };
    }
    return {
      bgClass: 'bg-yellow-50 border-yellow-200',
      textClass: 'text-yellow-800',
      iconClass: 'text-yellow-600',
      icon: AlertCircle,
      title: 'Connection Issue',
      subtitle: 'Connection Issues'
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`mb-4 p-4 rounded-lg border-2 ${config.bgClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon className={`w-5 h-5 ${config.iconClass}`} />
          </div>
          <div>
            <div className={`font-semibold ${config.textClass}`}>
              {config.title}
            </div>
            <div className={`text-sm mt-1 ${config.textClass}`}>
              {error || 'Server connection failed. Data may be outdated.'}
            </div>
            {retryAttempts > 0 && retryAttempts < maxRetries && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${config.textClass}`}>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Retrying... ({retryAttempts}/{maxRetries})
              </div>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="ml-4"
          disabled={isLoadingData || isRefreshing}
        >
          {isLoadingData || isRefreshing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Now
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Network Status Indicator for use in headers/sidebars
interface NetworkStatusIndicatorProps {
  serverStatus: 'live' | 'down';
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  serverStatus
}) => {
  const getServerStatusDisplay = (status: 'live' | 'down') => {
    return {
      text: status === 'live' ? 'Live' : 'Server Down',
      bgClass: status === 'live' 
        ? 'bg-green-100 border-green-200' 
        : 'bg-red-100 border-red-200',
      dotClass: status === 'live' ? 'bg-green-500' : 'bg-red-500',
      textClass: status === 'live' ? 'text-green-800' : 'text-red-800',
    };
  };

  const statusInfo = getServerStatusDisplay(serverStatus);

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border-2 ${statusInfo.bgClass}`}>
      <div className="relative">
        <div className={`w-3 h-3 rounded-full ${statusInfo.dotClass}`}>
          {serverStatus === 'live' && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75"></div>
          )}
        </div>
      </div>
      <div>
        <span className={`text-sm font-semibold ${statusInfo.textClass}`}>
          {statusInfo.text}
        </span>
        <p className="text-xs text-gray-500">
          {serverStatus === 'live' ? 'Connected' : 'Connection Lost'}
        </p>
      </div>
      {serverStatus === 'down' && (
        <div className="ml-auto">
          <AlertCircle className="w-4 h-4 text-red-500" />
        </div>
      )}
    </div>
  );
};