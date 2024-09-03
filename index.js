"use strict";
import express from 'express';
import { Server } from 'socket.io';
import cors from "cors";
import http from 'http';
import usersRoute from "./routes/users.js";
import messagesRoute from "./routes/messages.js";
import jwt from 'jsonwebtoken';
import generateRoomName from './lib/generateRoomName.js';
import db from './db.js';

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

io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;

    // Use a regular expression to extract the token from cookies
    const tokenMatch = cookieHeader && cookieHeader.match(/jwt-token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
        return next(new Error('Authentication error'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return next(new Error('Authentication error'));

        socket.user = user;
        next();
    });
});

io.on("connection", socket => {
    console.log("user connected", socket.id)

    socket.on('join-room', (receiverId) => {
        const roomId = generateRoomName(socket.user.sub, receiverId)
        socket.join(roomId);
        console.log(`User ${socket.user.sub} is joining room ${roomId}`);
    });

    socket.on('join-personal-room', () => {
        const roomId = socket.user.sub;
        socket.join(roomId);
        console.log(`User ${socket.user.sub} is joining personal room ${roomId}`);
    });

    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        console.log(`Socket ${socket.id} left room ${roomId}`);
    });

    socket.on('leave-personal-room', () => {
        const roomId = socket.user.sub;
        socket.leave(roomId);
        console.log(`Socket ${socket.user.sub} left personal room ${roomId}`);
    });

    // Handle sending a message
    socket.on('send-message', async ({ receiverId, content }) => {
        const senderId = socket.user.sub;
        const roomId = generateRoomName(senderId, receiverId)
        try {
            const query = 'INSERT INTO messages (senderId, receiverId, content, timestamp, isread) VALUES (?, ?, ?, ?, ?)';
            const timestamp = new Date();
            const isRead = 0;
            const [result] = await db.query(query, [senderId, receiverId, content, timestamp, isRead]);
            const insertedId = result.insertId;
            const [rows] = await db.query(`
                SELECT messages.*, aspnetusers.FirstName 
                FROM messages 
                JOIN aspnetusers ON messages.senderId = aspnetusers.Id 
                WHERE messages.MessageId = ?
            `, [insertedId]);

            const message = rows[0];
            socket.to(roomId).emit('receive-message', message);
            socket.emit('receive-message', message);
            socket.to(receiverId).emit('message-notification', { ReceiverId: receiverId, FirstName: message.FirstName })
        } catch (error) {
            console.error('Error saving message:', error);
        }
        // const message = {receiverId, senderId,  }
        // socket.to(roomId).emit('receive-message', message);
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