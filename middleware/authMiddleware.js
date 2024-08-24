import jwt from 'jsonwebtoken';

const authenticateToken = (req, res, next) => {
    // Assume the JWT is in a cookie-like format
    const authHeader = req.headers['authorization'] || req.headers['cookie'];
    let token;

    if (authHeader) {
        // Extract the token that starts with "jwt-token="
        const match = authHeader.match(/jwt-token=([^;]+)/);
        token = match ? match[1] : null;
    }

    if (token == null) return res.sendStatus(401); // If no token is found, deny access

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).send('Token expired');
            }
            return res.sendStatus(403); // Invalid token
        }

        req.user = user; // Attach user info to the request
        next(); // Move to the next middleware or route handler
    });
};

export default authenticateToken;
