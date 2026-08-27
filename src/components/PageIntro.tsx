import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageIntroProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Optional back link / control rendered above the title block */
  back?: ReactNode;
  className?: string;
  /** Soft icon mark shown left of the title block */
  icon?: ReactNode;
}

/**
 * Shared page header — Once UI–inspired hierarchy (eyebrow → title → one line)
 * without pulling a second design system.
 */
export default function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  back,
  className,
  icon,
}: PageIntroProps) {
  return (
    <div className={cn('space-y-3 ui-enter', className)}>
      {back}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="ui-icon-mark mt-0.5 shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0 space-y-1">
            {eyebrow && (
              <p className="ui-eyebrow">{eyebrow}</p>
            )}
            <h1 className="ui-page-title">{title}</h1>
            {description && (
              <p className="ui-page-desc">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end ui-enter ui-enter-delay-1">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
