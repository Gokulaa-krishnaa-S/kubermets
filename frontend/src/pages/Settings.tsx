import { Layout } from "@/components/layout/Layout";
import KubernetesInstanceList from "./kubernetesInstance";
import TopBar from "@/components/header/header";

export default function Settings() {
  return (
    <Layout
      title="Settings"
      subtitle="Configure your Kubernetes monitoring dashboard"
    >
      <TopBar
        title="Settings"
        subtitle="You can configure your Kubernetes monitoring dashboard here"
      />

      <div className="space-y-8 p-4 lg:p-6">
        {/* Directly render the instance list, which now includes its own header */}
        <KubernetesInstanceList />
      </div>
    </Layout>
  );
}
