import { Icon } from './Icon';

export function EmptyState({ icon, title, description, action, compact = false }: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`text-center text-gray-400 ${compact ? 'py-6' : 'py-12'}`}>
      {icon && <Icon name={icon as any} size={compact ? 28 : 40} className="mx-auto mb-3 text-gray-200" />}
      <p className="text-md2 font-medium text-gray-600 mb-1">{title}</p>
      {description && <p className="text-sm2 text-gray-400 whitespace-pre-line">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
