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

// **Read** all messages or messages for a specific user
router.get('/messages', async (req, res) => {
    const { userId } = req.query;

    try {
        const [rows] = userId
            ? await db.query('SELECT * FROM Messages WHERE SenderId = ? OR ReceiverId = ?', [userId, userId])
            : await db.query('SELECT * FROM Messages');
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

export default router;
