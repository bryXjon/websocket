const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Map: company_id (string) → Set of socket IDs
const userSockets = new Map();

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("register", (company_id) => {
    if (!company_id) return;

    const key = String(company_id); // Ensure consistent type
    if (!userSockets.has(key)) {
      userSockets.set(key, new Set());
    }

    const sockets = userSockets.get(key);
    if (!sockets.has(socket.id)) {
      sockets.add(socket.id);
      console.log(`Registered ${key} → ${socket.id}`);
    }

    socket.company_id = key;

    // Let client know registration was successful
    socket.emit("registered", { company_id: key });
  });

  socket.on("disconnect", () => {
    const key = socket.company_id;
    if (key && userSockets.has(key)) {
      const sockets = userSockets.get(key);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(key);
        console.log(`Disconnected last socket for ${key}`);
      } else {
        console.log(`Disconnected one socket from ${key}`);
      }
    }
  });
});

app.use(express.json());

// POST /send-notification
app.post("/send-notification", (req, res) => {
  const {
    company_ids = [],
    title,
    message,
    type = "announcement",
    category = "Update",
  } = req.body;

  const payload = {
    type,
    title,
    message,
    category,
    date: new Date().toLocaleString(),
  };

  const sentTo = [];
  const notConnected = [];

  // Debug: Dump the full map before sending
  console.log("\n Current userSockets state:");
  for (const [key, set] of userSockets.entries()) {
    console.log(`- ${key}: ${[...set].join(", ")}`);
  }

  if (type === "announcement") {
    userSockets.forEach((socketSet, key) => {
      socketSet.forEach((socketId) => io.to(socketId).emit("receive-notification", payload));
      sentTo.push(key);
    });
    console.log(`Broadcasted to ${sentTo.length} company(s)`);
  } else if (type === "for_approval") {
    company_ids.forEach((id) => {
      const key = String(id);
      const sockets = userSockets.get(key);
      if (sockets?.size) {
        sockets.forEach((socketId) => io.to(socketId).emit("receive-notification", payload));
        sentTo.push(key);
      } else {
        notConnected.push(key);
      }
    });
    console.log(`Approval notifications sent to: ${sentTo.join(", ")}`);
    if (notConnected.length) {
      console.warn(`Not connected: ${notConnected.join(", ")}`);
    }
  } else {
    return res.status(400).json({
      success: false,
      message: `Unknown notification type: "${type}".`,
    });
  }

  return res.json({
    success: true,
    type,
    sentTo,
    notConnected,
    message: "Notification dispatch complete.",
  });
});

// Simple broadcast endpoint
app.post("/broadcast", (req, res) => {
  const { title, content, category = "Update" } = req.body;
  const payload = {
    type: "announcement",
    title,
    message: content,
    category,
    date: new Date().toLocaleString(),
  };

  io.emit("receive-notification", payload);
  console.log("Broadcast sent:", payload);

  return res.json({ success: true, message: "Broadcast delivered to all clients." });
});

// Health check
app.get("/ping", (req, res) => {
  let total = 0;
  userSockets.forEach((set) => (total += set.size));
  res.json({ status: "OK", connectedSockets: total });
});

// Start the server
const PORT = 6001;
server.listen(PORT, () => {
  console.log(`Server is live at http://localhost:${PORT}`);
});
