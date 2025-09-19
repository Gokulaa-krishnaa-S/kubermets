import React from 'react'

const TopBar = ({ title, subtitle }) => {
  return (
    <div className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 py-2 sm:px-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {subtitle}
            {/* Complete Kubernetes metrics visualization across{" "}
                  {aggregated.clusterCount || 0} clusters */}
          </p>
        </div>
      </div>
    </div>
  )
}

export default TopBar
