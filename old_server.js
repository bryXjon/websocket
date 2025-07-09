const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with full CORS support
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Map to track active client connections by company ID
const userSockets = new Map();

// Handle socket connection events
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Registration: associate a company_id with a socket
  socket.on("register", (company_id) => {
    userSockets.set(company_id, socket.id);
    console.log(`Registered ${company_id} → ${socket.id}`);
  });

  // On disconnection, remove company mapping if matched
  socket.on("disconnect", () => {
    for (const [company_id, id] of userSockets) {
      if (id === socket.id) {
        userSockets.delete(company_id);
        console.log(`Disconnected ${company_id}`);
        break;
      }
    }
  });
});

app.use(express.json());

// Send notification to specific company IDs or broadcast based on type
app.post("/send-notification", (req, res) => {
  const {
    company_ids = [],
    title,
    message,
    type = "announcement", // default type
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

  if (type === "announcement") {
    // Broadcast to ALL connected users
    userSockets.forEach((socketId, company_id) => {
      io.to(socketId).emit("receive-notification", payload);
      sentTo.push(company_id);
    });
    console.log(`Broadcasted announcement to ${sentTo.length} user(s).`);
  } else if (type === "for_approval") {
    // Targeted delivery to listed company_ids
    company_ids.forEach((id) => {
      const socketId = userSockets.get(id);
      if (socketId) {
        io.to(socketId).emit("receive-notification", payload);
        sentTo.push(id);
      } else {
        notConnected.push(id);
      }
    });
    console.log(`Approval notifications sent to: ${sentTo.join(", ")}`);
    if (notConnected.length) {
      console.warn(`Not connected: ${notConnected.join(", ")}`);
    }
  } else {
    // Handle unknown type
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

// Broadcast endpoint
app.post("/broadcast", (req, res) => {
  const {
    title,
    content,
    category = "Update",
    date = new Date().toLocaleString(),
  } = req.body;

  const payload = {
    type: "announcement",
    title,
    message: content,
    category,
    date,
  };

  io.emit("receive-notification", payload);
  console.log("Broadcast sent:", payload);

  return res.json({
    success: true,
    message: "Broadcast delivered to all clients.",
  });
});

// Simple health check endpoint for monitoring
app.get("/ping", (req, res) => {
  res.json({
    status: "Socket server is running",
    connectedClients: userSockets.size,
  });
});

// Spin up the notification server
const PORT = 6001;
server.listen(PORT, () => {
  console.log(`Server is live at http://localhost:${PORT}`);
});
