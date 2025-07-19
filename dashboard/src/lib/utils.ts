import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  try {
    const d = new Date(date);
    // Check if date is valid
    if (isNaN(d.getTime())) {
      console.error('Invalid date:', date);
      return 'Invalid date';
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch (error) {
    console.error('Error formatting date:', date, error);
    return 'Invalid date';
  }
}

export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(date);
}

export function getLanguageColor(language: string | null): string {
  const colors: Record<string, string> = {
    JavaScript: '#f1e05a',
    TypeScript: '#2b7489',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Rust: '#dea584',
    C: '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Swift: '#ffac45',
    Kotlin: '#F18E33',
    Scala: '#c22d40',
    Shell: '#89e051',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Vue: '#4fc08d',
    React: '#61dafb',
  };

  return colors[language || ''] || '#6e7681';
}

export function getTierColor(tier: 1 | 2 | 3): string {
  switch (tier) {
    case 1:
      return 'text-purple-600 dark:text-purple-400';
    case 2:
      return 'text-blue-600 dark:text-blue-400';
    case 3:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function getTierBadge(tier: 1 | 2 | 3): { color: string; text: string } {
  switch (tier) {
    case 1:
      return { 
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', 
        text: 'Premium Target' 
      };
    case 2:
      return { 
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', 
        text: 'Emerging Opportunity' 
      };
    case 3:
      return { 
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', 
        text: 'Market Coverage' 
      };
  }
}

export function getAlertLevelColor(level: string): string {
  switch (level) {
    case 'urgent':
      return 'text-red-600 dark:text-red-400';
    case 'high':
      return 'text-orange-600 dark:text-orange-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
