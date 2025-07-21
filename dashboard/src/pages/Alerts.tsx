import { useQuery } from '@tanstack/react-query';
import { AlertCircle, TrendingUp, Zap, Info, Clock, Filter, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRelativeTime, getAlertLevelColor } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

const alertIcons = {
  urgent: AlertCircle,
  high: TrendingUp,
  medium: Zap,
  low: Info,
};

const alertTypeLabels = {
  high_growth: 'High Growth',
  investment_opportunity: 'Investment Opportunity',
  trend: 'Trend Alert',
};

interface AlertGroup {
  label: string;
  alerts: any[];
}

export default function Alerts() {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
  });

  const [expandedAlerts, setExpandedAlerts] = useState<Set<number>>(new Set());
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Group alerts by time period
  const groupedAlerts = useMemo(() => {
    if (!alerts?.alerts) return [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: AlertGroup[] = [
      { label: 'Today', alerts: [] },
      { label: 'Yesterday', alerts: [] },
      { label: 'This Week', alerts: [] },
      { label: 'Older', alerts: [] },
    ];

    const sortedAlerts = [...alerts.alerts]
      .filter(alert => {
        if (filterLevel !== 'all' && alert.level !== filterLevel) return false;
        if (filterType !== 'all' && alert.type !== filterType) return false;
        return true;
      })
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    sortedAlerts.forEach(alert => {
      const alertDate = new Date(alert.sent_at);
      if (alertDate >= today) {
        groups[0].alerts.push(alert);
      } else if (alertDate >= yesterday) {
        groups[1].alerts.push(alert);
      } else if (alertDate >= weekAgo) {
        groups[2].alerts.push(alert);
      } else {
        groups[3].alerts.push(alert);
      }
    });

    return groups.filter(group => group.alerts.length > 0);
  }, [alerts, filterLevel, filterType]);

  const toggleExpanded = (alertId: number) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  const alertStats = useMemo(() => {
    if (!alerts?.alerts) return { urgent: 0, high: 0, medium: 0, low: 0 };
    return alerts.alerts.reduce((acc, alert) => {
      acc[alert.level] = (acc[alert.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [alerts]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alert Center</h2>
        </div>
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="w-2 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalAlerts = alerts?.alerts.length || 0;

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alert Center</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {totalAlerts} active {totalAlerts === 1 ? 'alert' : 'alerts'}
          </p>
        </div>
        
        {/* Alert Stats */}
        <div className="flex items-center gap-4 text-sm">
          {Object.entries(alertStats).map(([level, count]) => (
            <div key={level} className="flex items-center gap-1">
              <span className={cn("w-2 h-2 rounded-full", {
                "bg-red-500": level === "urgent",
                "bg-orange-500": level === "high",
                "bg-yellow-500": level === "medium",
                "bg-blue-500": level === "low",
              })}></span>
              <span className="text-gray-600 dark:text-gray-400">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="high_growth">High Growth</option>
            <option value="investment_opportunity">Investment</option>
            <option value="trend">Trend</option>
          </select>
        </div>
      </div>

      {/* Alert Timeline */}
      {!groupedAlerts.length ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {totalAlerts === 0 ? 'No active alerts' : 'No alerts match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedAlerts.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {group.label}
                <span className="text-gray-500 dark:text-gray-500">({group.alerts.length})</span>
              </h3>
              
              <div className="space-y-2">
                {group.alerts.map((alert) => {
                  const Icon = alertIcons[alert.level as keyof typeof alertIcons] || Info;
                  const levelColor = getAlertLevelColor(alert.level);
                  const isExpanded = expandedAlerts.has(alert.id);
                  const hasMetadata = alert.metadata && Object.keys(alert.metadata).length > 0;
                  
                  // Filter out model-related metadata
                  const filteredMetadata = alert.metadata ? 
                    Object.entries(alert.metadata).filter(([key]) => 
                      !key.toLowerCase().includes('model') && 
                      !key.toLowerCase().includes('claude')
                    ) : [];

                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        "group relative flex gap-3 p-3 rounded-lg transition-all duration-200",
                        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                        "border-l-4",
                        {
                          "border-red-500 bg-red-50/50 dark:bg-red-900/10": alert.level === "urgent",
                          "border-orange-500": alert.level === "high",
                          "border-yellow-500": alert.level === "medium",
                          "border-blue-500": alert.level === "low",
                        }
                      )}
                    >
                      {/* Icon */}
                      <div className={cn("mt-0.5", levelColor)}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {alert.message}
                            </p>
                            
                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                {
                                  "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400": alert.level === "urgent",
                                  "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400": alert.level === "high",
                                  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400": alert.level === "medium",
                                  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400": alert.level === "low",
                                }
                              )}>
                                {alert.level}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                {alertTypeLabels[alert.type as keyof typeof alertTypeLabels] || alert.type}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                {formatRelativeTime(alert.sent_at)}
                              </span>
                            </div>

                            {/* Expandable Metadata */}
                            {hasMetadata && filteredMetadata.length > 0 && (
                              <div className="mt-2">
                                <button
                                  onClick={() => toggleExpanded(alert.id)}
                                  className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  View details
                                </button>
                                
                                {isExpanded && (
                                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                    <dl className="space-y-1">
                                      {filteredMetadata.map(([key, value]) => (
                                        <div key={key} className="flex items-start gap-2 text-xs">
                                          <dt className="text-gray-600 dark:text-gray-400 capitalize min-w-[100px]">
                                            {key.replace(/_/g, ' ')}:
                                          </dt>
                                          <dd className="text-gray-900 dark:text-white">
                                            {formatMetadataValue(value)}
                                          </dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {alert.metadata?.repo_url && (
                              <a
                                href={alert.metadata.repo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                title="View repository"
                              >
                                <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to format metadata values
function formatMetadataValue(value: any): string {
  if (typeof value === 'object' && value !== null) {
    // For arrays, join with commas
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    // For objects, show key-value pairs
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  
  // Format numbers
  if (typeof value === 'number') {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  }
  
  // Format percentages
  if (typeof value === 'string' && value.includes('%')) {
    return value;
  }
  
  return String(value);
}
