import type { GmailMessage, GmailThread } from './model.js';

export function renderThreadBody(thread: Omit<GmailThread, 'body'>): string {
  return [
    `# Gmail thread: ${thread.subject}`,
    '',
    ...(thread.mailbox ? [`- Mailbox: ${thread.mailbox}`] : []),
    `- Started: ${thread.created_at}`,
    `- Last activity: ${thread.updated_at}`,
    ...(thread.labels && thread.labels.length > 0 ? [`- Labels: ${thread.labels.join(', ')}`] : []),
    ...(thread.participants.length > 0
      ? [`- Participants: ${thread.participants.join(', ')}`]
      : []),
    '',
    ...thread.messages.flatMap(renderMessage),
  ]
    .join('\n')
    .trim();
}

function renderMessage(message: GmailMessage): string[] {
  const lines = [`## ${message.sent_at} - ${message.from ?? 'unknown sender'}`, ''];
  if (message.to && message.to.length > 0) {
    lines.push(`To: ${message.to.join(', ')}`);
  }
  if (message.cc && message.cc.length > 0) {
    lines.push(`Cc: ${message.cc.join(', ')}`);
  }
  if (message.bcc && message.bcc.length > 0) {
    lines.push(`Bcc: ${message.bcc.join(', ')}`);
  }
  if (message.subject) {
    lines.push(`Subject: ${message.subject}`);
  }
  if (message.labels && message.labels.length > 0) {
    lines.push(`Labels: ${message.labels.join(', ')}`);
  }

  if (lines.length > 2) {
    lines.push('');
  }

  lines.push(message.text || '(empty message body)');

  if (message.attachments && message.attachments.length > 0) {
    lines.push('', 'Attachments:');
    for (const attachment of message.attachments) {
      lines.push(
        `- ${[
          attachment.filename,
          attachment.mime_type,
          attachment.size === undefined ? undefined : `${attachment.size} bytes`,
        ]
          .filter(Boolean)
          .join(' - ')}`,
      );
    }
  }

  lines.push('');
  return lines;
}
