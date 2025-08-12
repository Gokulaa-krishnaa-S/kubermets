import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Moon, Bell, Shield } from "lucide-react";
import KubernetesInstanceList from "./kubernetesInstance";
import TopBar from "@/components/header/header";

export default function Settings() {
  return (
    <Layout
      title="Settings"
      subtitle="Configure your Kubernetes monitoring dashboard"
      
    >
      <TopBar
        title={"Settings"}
        subtitle={"You can configure your Kubernetes monitoring dashboard here"}
      />

      <div className="space-y-8 p-4 lg:p-6">
        {/* Instances section */}
        <div><CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Manage clusters
              </CardTitle>
            </CardHeader>
          <KubernetesInstanceList />
        </div>

        {/* Preferences & Notifications in responsive grid */}
        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Dashboard Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Toggle between light and dark themes
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Moon className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto Refresh</p>
                  <p className="text-sm text-muted-foreground">
                    Refresh metrics every 30 seconds
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="bg-success/10 text-success"
                >
                  Enabled
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Alert Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for critical issues
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="bg-success/10 text-success"
                >
                  Enabled
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Reports</p>
                  <p className="text-sm text-muted-foreground">
                    Daily cluster health reports
                  </p>
                </div>
                <Badge variant="outline">Disabled</Badge>
              </div>
            </CardContent>
          </Card>
        </div> */}

        {/* Security card */}
        {/* <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security & Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">API Access</p>
                    <p className="text-sm text-muted-foreground">
                      Manage API keys and permissions
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Manage
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div> */}
      </div>
    </Layout>
  );
}
