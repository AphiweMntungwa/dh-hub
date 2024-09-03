// routes/messages.js
import express from 'express';
import db from '../db.js'; // Adjust the path as necessary
import authenticateToken from '../middleware/authMiddleware.js';

const router = express.Router();

// **Create** a new message
router.post('/messages', authenticateToken, async (req, res) => {
    const { SenderId, ReceiverId, Content } = req.body;

    try {
        const [result] = await db.query(
            'INSERT INTO Messages (SenderId, ReceiverId, Content) VALUES (?, ?, ?)',
            [SenderId, ReceiverId, Content]
        );
        res.status(201).json({ messageId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// **Read** all messages between the current user and a specific user
router.get('/messages', authenticateToken, async (req, res) => {
    const { receiverId } = req.query; // Get receiverId from query
    const currentUserId = req.user.sub; // Get the current user's ID from the JWT token

    try {
        // Query to find messages between the current user and the receiver
        const [rows] = await db.query(
            `SELECT Messages.*, aspnetusers.FirstName 
                FROM Messages 
                JOIN aspnetusers ON Messages.SenderId = aspnetusers.Id 
                WHERE (Messages.SenderId = ? AND Messages.ReceiverId = ?) 
                OR (Messages.SenderId = ? AND Messages.ReceiverId = ?) 
                ORDER BY Messages.Timestamp`,
            [currentUserId, receiverId, receiverId, currentUserId]
        );

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// **Delete** a specific message by ID
router.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query('DELETE FROM Messages WHERE MessageId = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).send('Message not found');
        }
        res.status(204).send(); // No content
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get recently chatted users
router.get('/recent-chats', authenticateToken, async (req, res) => {
    const loggedInUserId = req.user.sub;

    try {
        const [rows] = await db.query(`
        SELECT ContactUserId
        FROM (
            SELECT DISTINCT
                CASE 
                    WHEN SenderId = ? THEN ReceiverId
                    ELSE SenderId
                END AS ContactUserId,
                MAX(Timestamp) AS LastMessageTimestamp
            FROM Messages
            WHERE SenderId = ? OR ReceiverId = ?
            GROUP BY CASE 
                        WHEN SenderId = ? THEN ReceiverId
                        ELSE SenderId
                     END
        ) AS Subquery
        ORDER BY LastMessageTimestamp DESC
      `, [loggedInUserId, loggedInUserId, loggedInUserId, loggedInUserId]);

        const userIds = rows.map(row => row.ContactUserId);

        if (userIds.length === 0) {
            return res.json([]);
        }

        // Get details of the users
        const [userDetails] = await db.query(`SELECT Id, FirstName, LastName, 
            RoomNumber, ResidenceId, StudentNumber FROM aspnetusers WHERE Id IN (?)`, [userIds]);

        res.json(userDetails);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get('/residence-users', authenticateToken, async (req, res) => {
    const loggedInUserId = req.user.sub;

    try {
        // Step 1: Get the ResidenceId of the logged-in user
        const [userResidence] = await db.query(`
            SELECT ResidenceId 
            FROM aspnetusers 
            WHERE Id = ?
        `, [loggedInUserId]);

        if (!userResidence || userResidence.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const residenceId = userResidence[0].ResidenceId;

        // Step 2: Query all users with the same ResidenceId
        const [residenceUsers] = await db.query(`
            SELECT Id, FirstName, LastName, RoomNumber, ResidenceId, StudentNumber 
            FROM aspnetusers 
            WHERE ResidenceId = ? AND Id != ?
        `, [residenceId, loggedInUserId]);

        res.json(residenceUsers);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

export default router;
