from typing import  Optional, Tuple
from datetime import datetime, timedelta, timezone
       
class HelperClass:
    def __init__(self):
        pass  
    # -------------------- Schema Formatters --------------------
    @staticmethod
    def bytes_to_gb(bytes_value: Optional[float]) -> Optional[float]:
        """Convert bytes to GB"""
        if bytes_value is None or bytes_value == 0:
            return 0.0
        return bytes_value / (1024**3)

    @staticmethod
    def calculate_percentage(
        usage: Optional[float], request: Optional[float]
    ) -> Optional[float]:
        """Calculate usage percentage"""
        if not usage or not request or request == 0:
            return 0.0
        return (usage / request) * 100

    @staticmethod
    def calculate_window_duration(start: str, end: str) -> str:
        """Calculate window duration from start and end times"""
        try:
            start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
            duration = end_dt - start_dt

            hours = duration.total_seconds() / 3600
            if hours >= 168:  # 7 days
                return "7d"
            elif hours >= 24:
                return f"{int(hours // 24)}d"
            elif hours >= 1:
                return f"{int(hours)}h"
            else:
                return f"{int(duration.total_seconds() // 60)}m"
        except:
            return "24h"  # default


    @staticmethod
    def classify_efficiency(efficiency: Optional[float]) -> str:
        """Classify efficiency into categories"""
        if efficiency is None or efficiency == 0:
            return "Low"
        elif efficiency >= 0.8:
            return "High"
        elif efficiency >= 0.5:
            return "Medium"
        else:
            return "Low"

    @staticmethod
    def parse_allocation_key(allocation_key: str) -> Tuple[str, str, str, str, str]:
        """
        Parse the allocation key to extract cluster, node, pod, namespace, and controller.
        Format: cluster/node/pod/namespace/controller
        Returns: (cluster_name, node_name, pod_name, namespace, controller)
        """
        if allocation_key in ["__idle__", "__unallocated__"]:
            return "", "", allocation_key, "", ""

        # Handle the full allocation key format
        if allocation_key.startswith("__idle__/"):
            return "", "", allocation_key, "", ""

        parts = allocation_key.split("/")
        if len(parts) >= 5:
            return parts[0], parts[1], parts[2], parts[3], parts[4]
        elif len(parts) == 4:
            return parts[0], parts[1], parts[2], parts[3], ""
        elif len(parts) == 3:
            return parts[0], parts[1], parts[2], "", ""
        elif len(parts) == 2:
            return parts[0], parts[1], "", "", ""
        else:
            return "", "", allocation_key, "", ""

    @staticmethod
    def extract_namespace_and_name(
        allocation_key: str,
    ) -> tuple[Optional[str], Optional[str]]:
        """Extract namespace and name from allocation key"""
        # Handle different pod naming patterns
        if allocation_key in ["__idle__", "__unallocated__"]:
            return None, allocation_key

        # Parse the new allocation key format
        cluster, node, pod, namespace, controller = HelperClass.parse_allocation_key(allocation_key)

        if namespace:
            return namespace, pod or controller or allocation_key

        # Fallback to original logic for backward compatibility
        parts = allocation_key.split("/")
        if len(parts) == 2:
            return parts[0], parts[1]

        if "-" in allocation_key:
            parts = allocation_key.split("-")
            if len(parts) >= 2:
                return None, allocation_key

        return None, allocation_key


    def round_down_time(self,dt: datetime, delta: timedelta) -> datetime:
        """
        Round down the given datetime `dt` to the nearest multiple of `delta`.
        Example: if delta = 1h and dt = 04:29 -> 04:00
        """
        print(dt,delta , "-----")
        # Ensure timezone-aware datetime
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        delta_seconds = int(delta.total_seconds())
        epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
        seconds_since_epoch = int((dt - epoch).total_seconds())
        rounded_seconds = (seconds_since_epoch // delta_seconds) * delta_seconds
        return epoch + timedelta(seconds=rounded_seconds)

