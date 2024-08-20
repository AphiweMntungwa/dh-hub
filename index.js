"use strict";
import express from 'express';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import cors from "cors";
import http from 'http';

const app = express();
const server = http.createServer(app);
const port = process.env.port || 3001;

app.use(cors())
server.listen(port, () => {
    console.log('LISTENING ON PORT', port)
})

const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/residences'
mongoose.connect(dbUrl).then(() => console.log('DB CONNECTION SUCCESSFUL')).
    catch(error => handleError(error));

mongoose.connection.on('error', err => {
    logError(err);
});


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
