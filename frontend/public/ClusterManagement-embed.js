(function() {
    'use strict';
   
    // Initialize embed when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeEmbed);
    } else {
      initializeEmbed();
    }
   
    function initializeEmbed() {
      try {
        embedClusterManagement();
      } catch (error) {
        console.error('ClusterManagement embed initialization failed:', error);
      }
    }
   
    function embedClusterManagement() {
      const ClusterManagementConfig = window.ClusterManagementConfig || {};
      // Validate configuration
      if (!ClusterManagementConfig.baseUrl) {
        console.error('ClusterManagement: baseUrl is required in ClusterManagementConfig');
        return;
      }
   
      // Build query parameters with proper encoding
      const queryParams = new URLSearchParams();
     
      for (const key in ClusterManagementConfig) {
        if (key !== 'isDev' && key !== 'baseUrl' && ClusterManagementConfig[key] !== undefined) {
          queryParams.append(key, String(ClusterManagementConfig[key]));
        }
      }
   
      // const queryString = queryParams.toString();
      const baseUrl = ClusterManagementConfig.baseUrl.replace(/\/$/, ''); // Remove trailing slash
      // const embedUrl = `${baseUrl}${queryString ? '?' + queryString : ''}`;
      const embedUrl = `${baseUrl}`
   
      // Find the container element
      let container = document.getElementById('ClusterManagement-container');
     
      if (!container) {
        console.warn('ClusterManagement: No element with id "ClusterManagement-container" found. Creating default container.');
        container = document.createElement('div');
        container.id = 'ClusterManagement-container';
      container.style.cssText = 'width: 100%;';
        document.body.appendChild(container);
      }
   
      // Check if iframe already exists
      const existingIframe = document.getElementById('ClusterManagement-embed-window');
      if (existingIframe) {
        existingIframe.remove();
      }
   
      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.allow = "fullscreen";
      iframe.title = "ClusterManagement embed window";
      iframe.id = 'ClusterManagement-embed-window';
      iframe.src = embedUrl;
    iframe.style.cssText = 'border: none; width: 100%; height: 90vh; border-radius: 0.5rem; box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px 0px; background-color: #F3F4F6;';
     
      // Add loading state
      iframe.onload = function() {
        console.log('ClusterManagement embed loaded successfully');
      };
     
      iframe.onerror = function() {
        console.error('ClusterManagement embed failed to load');
        iframe.style.backgroundColor = '#fee2e2';
        iframe.style.color = '#991b1b';
      };
     
      container.appendChild(iframe);
     
      console.log('ClusterManagement embed initialized with URL:', embedUrl);
    }
   
    // Expose global function for manual initialization
    window.embedClusterManagement = embedClusterManagement;
  })();