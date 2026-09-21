import type { CSSProperties, ReactElement } from 'react';
import type { MountOptions, MountHandle, BackgroundConfig } from './index';

export type BackgroundProps = MountOptions & {
  className?: string;
  style?: CSSProperties;
};

export declare function Background(props: BackgroundProps): ReactElement | null;
export declare function mount(target?: string | HTMLElement, options?: MountOptions): MountHandle;
export type { MountOptions, BackgroundConfig };
