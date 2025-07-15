import { useQuery } from '@tanstack/react-query';
import { AlertCircle, TrendingUp, Zap, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { formatRelativeTime, getAlertLevelColor } from '@/lib/utils';

const alertIcons = {
  urgent: AlertCircle,
  high: TrendingUp,
  medium: Zap,
  low: Info,
};

export default function Alerts() {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const sortedAlerts = alerts?.alerts.sort((a, b) => 
    new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {alerts?.alerts.length || 0} active alerts
        </div>
      </div>

      {!sortedAlerts || sortedAlerts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No active alerts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedAlerts.map((alert) => {
            const Icon = alertIcons[alert.level as keyof typeof alertIcons] || Info;
            const levelColor = getAlertLevelColor(alert.level);

            return (
              <Card key={alert.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-800`}>
                      <Icon className={`h-6 w-6 ${levelColor}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                            {alert.message}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className={`font-medium ${levelColor}`}>
                              {alert.level.toUpperCase()}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {alert.type}
                            </span>
                            <span className="text-gray-500 dark:text-gray-500">
                              {formatRelativeTime(alert.sent_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Details
                          </h4>
                          <div className="space-y-1">
                            {Object.entries(alert.metadata).map(([key, value]) => (
                              <div key={key} className="flex items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400 capitalize">
                                  {key.replace(/_/g, ' ')}:
                                </span>
                                <span className="ml-2 text-gray-900 dark:text-white">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
