"use strict";
import express from 'express';
import { Server } from 'socket.io';
import cors from "cors";
import http from 'http';
import usersRoute from "./routes/users.js";
import messagesRoute from "./routes/messages.js";

const app = express();
const server = http.createServer(app);
const port = process.env.port || 3001;

const corsOptions = {
    origin: 'http://localhost:3000', // Allow only this origin
    credentials: true,               // Allow credentials (e.g., cookies, authorization headers)
  };

app.use(cors(corsOptions));

app.use(express.json()); // Middleware to parse JSON bodies

app.use('/api', usersRoute); // Mount the route at /api/users
app.use('/api', messagesRoute); // Mount the route at /api/messages


// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

server.listen(port, () => {
    console.log('LISTENING ON PORT', port)
})

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',  // Use your frontend's URL here
        methods: ["GET", "POST"],
        credentials: true,  // Required for handling credentials
    }
});

io.on("connection", socket => {
    console.log("user connected", socket.id)
    // Handle joining a room
    socket.on('join-room', (roomId) => {
        console.log(`pre room join ${roomId}`);
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    // Handle leaving a room
    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        console.log(`Socket ${socket.id} left room ${roomId}`);
    });

    // Handle sending a message
    socket.on('send-message', ({ roomId, message }) => {
        console.log(`Message received in room ${roomId}: ${message}`);
        // Broadcast message to all sockets in the specified room
        socket.to(roomId).emit('receive-message', message);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log("user disconnected", socket.id);
    });
})

app.get("/res", (req, res) => {
    res.send({ ubani: "ubaba" })
});

app.get('*', (req, res) => {
    res.status(404).send('Page not found');
});
