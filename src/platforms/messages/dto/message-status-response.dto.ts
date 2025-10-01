export class MessageStatusResponse {
  jobId: string;
  status: string;
  progress?: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt?: Date;
}
