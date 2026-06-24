import { Badge as AxpBadge, type BadgeProps as AxpBadgeProps } from '@muhayu/axp-ui';

export type BadgeColor = 'brand' | 'violet' | 'amber' | 'green' | 'red' | 'neutral';

const colorMap: Record<BadgeColor, AxpBadgeProps['color']> = {
  brand:   'primary',
  violet:  'info',
  amber:   'warning',
  green:   'success',
  red:     'danger',
  neutral: 'secondary',
};

interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ color = 'neutral', children, className, style }: BadgeProps) {
  return (
    <AxpBadge
      color={colorMap[color]}
      variant="filled"
      rounded="full"
      size="sm"
      className={className}
      style={style}
    >
      {children}
    </AxpBadge>
  );
}
