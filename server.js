import cors from "cors";
import express from "express";
import { createServer } from "http";
import morgan from "morgan";
import { Server } from "socket.io";

let users = [];
let liveSessions = [];

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

// Endpoint to view live sessions
app.get("/live-sessions", (req, res) => {
  res.json({ liveSessions });
});

// Middleware to authenticate users
io.use((socket, next) => {
  const { callerId } = socket.handshake.query;
  if (callerId) {
    socket.data.user = callerId;
    next();
  } else {
    console.log("No caller ID found");
    next(new Error("No caller ID found"));
  }
});

// Handle socket connections
io.on("connection", (socket) => {
  const userId = socket.data.user;
  console.log("User connected:", userId);

  socket.join(userId);

  // Notify user about existing live sessions
  io.to(userId).emit("live-sessions", { liveSessions });

  // Start a live session
  socket.on("start-live", ({ sessionName }) => {
    console.log(`${userId} started a live session: ${sessionName}`);
    const session = { hostId: userId, sessionName };
    liveSessions.push(session);
    io.emit("new-live-session", session);
  });

  // Handle join live session
  socket.on("join-live", ({ hostId }) => {
    console.log(`${userId} is joining the live session hosted by ${hostId}`);
    io.to(hostId).emit("incoming-viewer", { viewerId: userId });
  });

  // Handle offer from broadcaster to viewer
  socket.on("offer", ({ to, offer }) => {
    console.log(`Offer from ${userId} to ${to}`);
    io.to(to).emit("offer", { from: userId, offer });
  });

  // Handle answer from viewer to broadcaster
  socket.on("answer", ({ to, answer }) => {
    console.log(`Answer from ${userId} to ${to}`);
    io.to(to).emit("answer", { from: userId, answer });
  });

  // Handle ICE candidates
  socket.on("ice-candidate", ({ to, candidate }) => {
    console.log(`ICE Candidate from ${userId} to ${to}`);
    io.to(to).emit("ice-candidate", { from: userId, candidate });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId}`);
    liveSessions = liveSessions.filter((session) => session.hostId !== userId);
    io.emit("live-session-ended", { hostId: userId });
  });
});

// Start server
const PORT = 8088;
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the live streaming API!" });
});
httpServer.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

