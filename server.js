const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

async function start() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`,
      credentials: true
    }
  });

  global.__unibox_io = io;

  io.on("connection", socket => {
    socket.on("join-org", orgId => {
      if (typeof orgId === "string" && orgId.trim()) {
        socket.join(`org:${orgId}`);
      }
    });

    socket.on("join-conversation", conversationId => {
      if (typeof conversationId === "string" && conversationId.trim()) {
        socket.join(`conversation:${conversationId}`);
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(`Unibox ready on http://${hostname}:${port}`);
  });
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
