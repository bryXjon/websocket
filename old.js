const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});


const userSockets = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (company_id) => {
    userSockets.set(company_id, socket.id);
    console.log(`User ${company_id} registered with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    for (const [company_id, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(company_id);
        console.log(`User ${company_id} disconnected`);
        break;
      }
    }
  });
});

// HTTP endpoint to emit to a specific user
app.use(express.json());
// app.post("/send-notification", (req, res) => {
//     const { company_id, message, title } = req.body;

//     const socketId = userSockets.get(company_id);
//     if (socketId) {
//         io.to(socketId).emit("receive-notification", { title, message });
//         console.log(`Notification sent to user ${company_id}:`, { title, message });
//         res.json({ success: true });
//     } else {
//         console.log(`User ${company_id} is not connected.`);
//         res.status(404).json({ success: false, message: "User not connected." });
//     }
// });

app.post("/send-notification", (req, res) => {
  const { company_ids, message, title } = req.body;

  if (!Array.isArray(company_ids) || company_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "company_ids must be a non-empty array",
    });
  }

  let sentTo = [];
  let notConnected = [];

  //   company_ids.forEach((company_id) => {
  //     const socketId = userSockets.get(company_id);
  //     if (socketId) {
  //       io.to(socketId).emit("receive-notification", { title, message });
  //       console.log(`Notification sent to user ${company_id}:`, {
  //         title,
  //         message,
  //       });
  //       sentTo.push(company_id);
  //     } else {
  //       console.log(`User ${company_id} is not connected.`);
  //       notConnected.push(company_id);
  //     }
  //   });
  company_ids.forEach((company_id) => {
    const socketId = userSockets.get(company_id);
    if (socketId) {
      io.to(socketId).emit("receive-notification", { title, message });
      console.log(`Notification sent to user ${company_id}:`, {
        title,
        message,
      });
      sentTo.push(company_id); // Track successfully sent notifications
    }
    // If no socketId, simply skip (no action taken)
  });

  res.json({
    success: true,
    sentTo,
    notConnected,
    message: "Notifications have been processed.",
  });
});

server.listen(6001, () => {
  console.log("Server is running on port 3000");
});
