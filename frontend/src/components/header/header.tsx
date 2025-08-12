import React from 'react'

const TopBar = ({title, subtitle}) => {
  return (
     <div className="mb-6">
            <div className="flex items-center justify-between">
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
