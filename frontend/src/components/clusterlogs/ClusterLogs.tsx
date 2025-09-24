import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Terminal,
    Play,
    Pause,
    RotateCcw,
    Download,
    X,
    Maximize2,
    Minimize2,
    Clock,
    Activity,
    AlertCircle,
    CheckCircle,
    Info
} from "lucide-react";
import ClusterService from "../../services/ClusterService";

interface ClusterLogsProps {
    clusterId: string;
    jobId?: string;
    isOpen: boolean;
    onClose: () => void;
    onMaximize?: () => void;
    isMaximized?: boolean;
}

interface LogEntry {
    line: number;
    content: string;
    timestamp: string;
    level?: 'info' | 'warning' | 'error' | 'success';
}

interface ParsedLogInfo {
    deploymentId: string | null;
    status: string | null;
    timestamp: string | null;
    events: LogEntry[];
}

const ClusterLogs: React.FC<ClusterLogsProps> = ({
    clusterId,
    jobId,
    isOpen,
    onClose,
    onMaximize,
    isMaximized = false
}) => {
    const [logs, setLogs] = useState<string>('');
    const [parsedInfo, setParsedInfo] = useState<ParsedLogInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [isAutoRefresh, setIsAutoRefresh] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [sinceSeconds, setSinceSeconds] = useState(10);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-scroll to bottom when new logs arrive
    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [logs]);

    // Auto-refresh functionality
    useEffect(() => {
        if (isAutoRefresh && jobId) {
            intervalRef.current = setInterval(() => {
                fetchRecentLogs();
            }, 5000); // Refresh every 5 seconds

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }
    }, [isAutoRefresh, jobId]);

    const fetchInitialLogs = async () => {
        if (!jobId) return;

        try {
            setLoading(true);
            setError(null);
            console.log('Fetching initial logs for job ID:', jobId);

            const logsData = await ClusterService.getJobLogs(jobId);
            const logsContent = logsData.logs || '';
            console.log('Initial logs received:', logsContent.substring(0, 200) + '...');

            setLogs(logsContent);

            // Parse the logs to extract deployment information
            const parsedInfo = ClusterService.parseJobLogs(logsContent);
            console.log('Parsed deployment info:', parsedInfo);
            setParsedInfo(parsedInfo);
            setLastUpdate(new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Failed to fetch initial job logs:', error);
            setError('Failed to load logs');
            setLogs('Failed to load logs');
        } finally {
            setLoading(false);
        }
    };

    const fetchRecentLogs = async () => {
        if (!jobId) return;

        try {
            console.log('Fetching recent logs for job ID:', jobId, 'since', sinceSeconds, 'seconds');

            const logsData = await ClusterService.getJobLogsSince(jobId, sinceSeconds);
            const logsContent = logsData.logs || '';

            if (logsContent !== logs) {
                setLogs(logsContent);

                // Parse the logs to extract deployment information
                const parsedInfo = ClusterService.parseJobLogs(logsContent);
                setParsedInfo(parsedInfo);
                setLastUpdate(new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error('Failed to fetch recent job logs:', error);
            setError('Failed to fetch recent logs');
        }
    };

    const handleRefresh = () => {
        fetchInitialLogs();
    };

    const handleAutoRefreshToggle = () => {
        setIsAutoRefresh(!isAutoRefresh);
    };

    const handleDownload = () => {
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cluster-${clusterId}-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getLogLevelIcon = (level?: string) => {
        switch (level) {
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'warning':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'success':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            default:
                return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const getLogLevelColor = (level?: string) => {
        switch (level) {
            case 'error':
                return 'text-red-400';
            case 'warning':
                return 'text-yellow-400';
            case 'success':
                return 'text-green-400';
            default:
                return 'text-gray-300';
        }
    };

    // Initialize logs when component opens
    useEffect(() => {
        if (isOpen && jobId) {
            fetchInitialLogs();
        }
    }, [isOpen, jobId]);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 ${isMaximized ? 'p-2' : 'p-8'}`}>
            <Card className={`bg-gray-900 text-white border-gray-700 ${isMaximized ? 'w-full h-full' : 'w-4/5 h-4/5'} max-w-6xl`}>
                <CardHeader className="bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Terminal className="w-5 h-5 text-green-400" />
                            <CardTitle className="text-lg font-semibold">
                                Cluster Logs - {clusterId}
                            </CardTitle>
                            {jobId && (
                                <Badge variant="outline" className="text-xs">
                                    Job: {jobId}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAutoRefreshToggle}
                                    className={`${isAutoRefresh ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'} text-white border-gray-600`}
                                >
                                    {isAutoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    {isAutoRefresh ? 'Pause' : 'Auto'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
                                >
                                    <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownload}
                                    className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
                                >
                                    <Download className="w-4 h-4" />
                                </Button>
                                {onMaximize && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onMaximize}
                                        className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
                                    >
                                        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onClose}
                                    className="bg-red-600 hover:bg-red-700 text-white border-red-500"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Status Bar */}
                    <div className="flex items-center justify-between mt-3 text-sm">
                        <div className="flex items-center gap-4">
                            {parsedInfo?.status && (
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-blue-400" />
                                    <span className="text-gray-300">Status: {parsedInfo.status}</span>
                                </div>
                            )}
                            {lastUpdate && (
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-400">Last updated: {lastUpdate}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">Since:</span>
                            <select
                                value={sinceSeconds}
                                onChange={(e) => setSinceSeconds(Number(e.target.value))}
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                            >
                                <option value={5}>5s</option>
                                <option value={10}>10s</option>
                                <option value={30}>30s</option>
                                <option value={60}>1m</option>
                                <option value={300}>5m</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0 h-full">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-400"></div>
                                <span className="text-gray-300">Loading logs...</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <p className="text-red-400 mb-2">Failed to load logs</p>
                                <p className="text-gray-400 text-sm">{error}</p>
                                <Button
                                    onClick={handleRefresh}
                                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full overflow-hidden">
                            <div className="h-full overflow-y-auto bg-black p-4 font-mono text-sm">
                                {logs ? (
                                    <div className="space-y-1">
                                        {logs.split('\n').map((line, index) => {
                                            const logEntry = parsedInfo?.events.find(e => e.line === index + 1);
                                            return (
                                                <div
                                                    key={index}
                                                    className={`flex items-start gap-3 py-1 hover:bg-gray-800 px-2 rounded ${logEntry?.level ? getLogLevelColor(logEntry.level) : 'text-gray-300'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                                                        <span className="text-gray-500 text-xs w-8 text-right">
                                                            {String(index + 1).padStart(3, '0')}
                                                        </span>
                                                        {logEntry?.level && getLogLevelIcon(logEntry.level)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="whitespace-pre-wrap break-words">
                                                            {line || ' '}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={logsEndRef} />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-center">
                                            <Terminal className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                                            <p className="text-gray-400">No logs available</p>
                                            <p className="text-gray-500 text-sm">Click refresh to load logs</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ClusterLogs;