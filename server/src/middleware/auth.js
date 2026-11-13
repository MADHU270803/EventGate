import jwt from "jsonwebtoken";

// Checks the "wristband" (token) sent with a request.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please log in first" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ message: "Your session is invalid or has expired. Please log in again." });
  }
}

// Allows only one kind of user (for example, only organizers).
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "You do not have permission to do this" });
    }
    next();
  };
}