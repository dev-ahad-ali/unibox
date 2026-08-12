const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

/**
 * Reads the Supabase configuration.
 *
 * This MUST be called after `app.prepare()`. Next.js loads .env.local during
 * prepare(), so reading these at module scope returns undefined even when the
 * file is present — which silently disabled socket authentication and left
 * every client in no room at all.
 */
function readSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return { url, anonKey, serviceRoleKey, authEnabled: Boolean(url && anonKey && serviceRoleKey) };
}

/**
 * Resolves a socket connection to the org it is allowed to listen to.
 *
 * Rooms carry full message bodies, so letting a client pick its own room would
 * leak every conversation to anyone who guessed an org id. The org is derived
 * from the caller's own access token instead — never from what they send.
 */
async function resolveOrgId(config, accessToken) {
  if (!accessToken) {
    return null;
  }

  const auth = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: member } = await service
    .from("org_users")
    .select("org_id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  return member?.org_id ?? null;
}

async function start() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  // Only now is .env.local in process.env.
  const config = readSupabaseConfig();

  const server = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`,
      credentials: true
    }
  });

  io.use(async (socket, nextFn) => {
    // Demo mode has no identity provider, so there is nothing to verify.
    if (!config.authEnabled) {
      socket.data.orgId = null;
      socket.data.demo = true;
      return nextFn();
    }

    try {
      const orgId = await resolveOrgId(config, socket.handshake.auth?.accessToken);
      if (!orgId) {
        return nextFn(new Error("unauthorized"));
      }
      socket.data.orgId = orgId;
      return nextFn();
    } catch (error) {
      return nextFn(new Error("unauthorized"));
    }
  });

  global.__unibox_io = io;

  io.on("connection", socket => {
    // The client no longer chooses its room; it is joined to its own org.
    if (socket.data.orgId) {
      socket.join(`org:${socket.data.orgId}`);
    }

    socket.on("join-conversation", conversationId => {
      // Conversation payloads are also emitted to the org room, which is
      // already scoped, so this is only a narrowing subscription.
      if (typeof conversationId === "string" && conversationId.trim()) {
        socket.join(`conversation:${conversationId}`);
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(`Unibox ready on http://${hostname}:${port}`);
    if (config.authEnabled) {
      console.log("[unibox] Supabase configured — sessions and socket auth are active.");
    } else {
      console.warn("[unibox] Supabase is not configured — running in demo mode with no auth.");
    }
  });
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
