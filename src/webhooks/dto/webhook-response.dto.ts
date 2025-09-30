import { WebhookEventType } from '../types/webhook-event.types';

export class WebhookResponse {
  id: string;
  projectId: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  message?: string; // Only present on creation
}

export class WebhookDetailResponse extends WebhookResponse {
  stats: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: string;
  };
}

export class WebhookDeliveryResponse {
  id: string;
  event: WebhookEventType;
  status: 'pending' | 'success' | 'failed';
  responseCode: number | null;
  error: string | null;
  attempts: number;
  deliveredAt: Date | null;
  createdAt: Date;
  payload: Record<string, unknown>;
}

export class WebhookDeliveryListResponse {
  deliveries: WebhookDeliveryResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
