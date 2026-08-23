import { Suspense } from 'react';
import { Tag } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import type { LucideProps } from 'lucide-react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

interface DynamicCategoryIconProps extends Omit<LucideProps, 'ref'> {
  name?: string | null;
}

export function DynamicCategoryIcon({ name, ...props }: DynamicCategoryIconProps) {
  const key = (name || 'tag').toLowerCase().replace(/_/g, '-') as keyof typeof dynamicIconImports;
  const importer = dynamicIconImports[key];

  if (!importer) return <Tag {...props} />;

  const Icon = lazyWithRetry(importer);
  return (
    <Suspense fallback={<span className={props.className} aria-hidden />}>
      <Icon {...props} />
    </Suspense>
  );
}
