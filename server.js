const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const userSockets = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("register", (company_id) => {
    userSockets.set(company_id, socket.id);
    console.log(`✅ Registered ${company_id} → ${socket.id}`);
  });

  socket.on("disconnect", () => {
    for (const [company_id, id] of userSockets) {
      if (id === socket.id) {
        userSockets.delete(company_id);
        console.log(`🔌 Disconnected ${company_id}`);
        break;
      }
    }
  });
});

app.use(express.json());

// 🎯 Send to specific companies
app.post("/send-notification", (req, res) => {
  const { company_ids, title, message } = req.body;

  if (!Array.isArray(company_ids)) {
    return res.status(400).json({ success: false, message: "Missing company_ids[]" });
  }

  const sentTo = [];
  const notConnected = [];

  setTimeout(() => {
    company_ids.forEach((id) => {
      const socketId = userSockets.get(id);
      if (socketId) {
        io.to(socketId).emit("receive-notification", {
          type: "announcement",
          title,
          message,
          category: "Update",
          date: new Date().toLocaleString()
        });
        sentTo.push(id);
      } else {
        notConnected.push(id);
      }
    });
  }, 3000);

  res.json({
    success: true,
    sentTo,
    notConnected,
    message: "Scheduled notification dispatch."
  });
});

// 📢 Broadcast to all
app.post("/broadcast", (req, res) => {
  const { title, content, category, date } = req.body;
  const payload = {
    type: "announcement",
    title,
    message: content,
    category: category || "Update",
    date: date || new Date().toLocaleString()
  };

  setTimeout(() => {
    io.emit("receive-notification", payload);
    console.log("📣 Broadcast sent:", payload);
  }, 3000);

  res.json({ success: true, message: "Broadcast scheduled." });
});

const PORT = 6001;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
