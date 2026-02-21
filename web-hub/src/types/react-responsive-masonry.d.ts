declare module 'react-responsive-masonry' {
  import type { ComponentType, ReactNode } from 'react';

  interface MasonryProps {
    columnsCount?: number;
    gutter?: string;
    className?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }

  interface ResponsiveMasonryProps {
    columnsCountBreakPoints?: Record<number, number>;
    className?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }

  export const Masonry: ComponentType<MasonryProps>;

  const ResponsiveMasonry: ComponentType<ResponsiveMasonryProps>;
  export default ResponsiveMasonry;
  export { ResponsiveMasonry };
}
