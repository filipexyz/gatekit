export enum PlatformCapability {
  // Core
  SEND_MESSAGE = 'send-message',
  RECEIVE_MESSAGE = 'receive-message',
  EDIT_MESSAGE = 'edit-message',
  DELETE_MESSAGE = 'delete-message',

  // Rich Content
  ATTACHMENTS = 'attachments',
  EMBEDS = 'embeds',
  BUTTONS = 'buttons',

  // Interactions
  REACTIONS = 'reactions',
  THREADS = 'threads',
}
