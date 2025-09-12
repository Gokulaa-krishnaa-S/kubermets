import { useOutletContext } from "react-router-dom";

interface MetricContext {
  selectedHash: string;
}

export function useSelectedHash() {
  return useOutletContext<MetricContext>();
}