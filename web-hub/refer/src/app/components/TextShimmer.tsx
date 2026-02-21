/**
 * TextShimmer — moving highlight that sweeps across gradient text.
 * Inspired by: Apple.com, Arc Browser, Linear.app
 */
import { cn } from '../../lib/utils';

interface TextShimmerProps {
  children: React.ReactNode;
  className?: string;
  /** If true renders as a block-level element */
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div';
}

export function TextShimmer({ children, className, as: Tag = 'span' }: TextShimmerProps) {
  return (
    <Tag className={cn('text-shimmer', className)}>
      {children}
    </Tag>
  );
}
