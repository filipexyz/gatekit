export class MessageSendResponse {
  success: boolean;
  jobId: string;
  status: string;
  targets: Array<{
    platformId: string;
    type: string;
    id: string;
  }>;
  platformIds: string[];
  timestamp: string;
  message: string;
}
