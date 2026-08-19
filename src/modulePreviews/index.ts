import { ComponentType } from 'react';
import InspectionsPreview from './InspectionsPreview';
import WastePreview from './WastePreview';
import MsdsPreview from './MsdsPreview';
import OpinionsPreview from './OpinionsPreview';
import FinanceManagementPreview from './FinanceManagementPreview';
import EvaluationsPreview from './EvaluationsPreview';
import LegislationsPreview from './LegislationsPreview';
import RequestsPreview from './RequestsPreview';
import ActionsPreview from './ActionsPreview';
import DocumentRequestsPreview from './DocumentRequestsPreview';
import OrgChartPreview from './OrgChartPreview';
import DepartedPreview from './DepartedPreview';

export const MODULE_PREVIEWS: Record<string, ComponentType> = {
  inspections: InspectionsPreview,
  waste: WastePreview,
  msds: MsdsPreview,
  opinions: OpinionsPreview,
  finance_management: FinanceManagementPreview,
  evaluations: EvaluationsPreview,
  legislations: LegislationsPreview,
  requests: RequestsPreview,
  actions: ActionsPreview,
  document_requests: DocumentRequestsPreview,
  org_chart: OrgChartPreview,
  departed: DepartedPreview,
};

export { default as ModulePreviewModal } from './ModulePreviewModal';
