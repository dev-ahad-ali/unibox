type SocketServer = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
  emit: (event: string, payload: unknown) => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __unibox_io: SocketServer | undefined;
}

export function emitOrgEvent(orgId: string, event: string, payload: unknown) {
  globalThis.__unibox_io?.to(`org:${orgId}`).emit(event, payload);
}

export function emitConversationEvent(conversationId: string, event: string, payload: unknown) {
  globalThis.__unibox_io?.to(`conversation:${conversationId}`).emit(event, payload);
}
