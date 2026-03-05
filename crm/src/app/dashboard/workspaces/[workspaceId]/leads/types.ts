export type LeadRow = {
  id: string;
  connectionId: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  source: string;
  lastCapturedAt: string;
  createdAt: string;
};

export type LeadsListResponse = {
  data: {
    items: LeadRow[];
    total?: number;
    limit: number;
    offset: number;
  };
};

export type LeadEventRow = {
  id: string;
  connectionId: string;
  type: string;
  occurredAt: string;
  createdAt: string;
  payload: unknown;
};

export type LeadDetail = {
  id: string;
  workspaceId: string;
  connectionId: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  source: string;
  lastCapturedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadDetailResponse = {
  data: {
    lead: LeadDetail;
    events: LeadEventRow[];
  };
};
