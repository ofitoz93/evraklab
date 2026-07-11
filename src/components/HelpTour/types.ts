import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TourStep {
  id: string;
  title: string;
  body: string;
}

export type TourId =
  | 'documents'
  | 'envReport'
  | 'addDocument'
  | 'forwardDoc'
  | 'wetSignature'
  | 'consultantPanel';

export interface TourStageProps {
  roleLabel?: string;
}

export interface TourDefinition {
  id: TourId;
  title: string;
  steps: TourStep[];
  StageComponent: ComponentType<TourStageProps>;
}

export interface TourMeta {
  title: string;
  description: string;
  icon: LucideIcon;
  load: () => Promise<{ default: TourDefinition }>;
}
