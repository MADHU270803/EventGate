import "dotenv/config";
import app from "./app.js";

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in server/.env. Add it and restart.");
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`EventGate API running on http://localhost:${PORT}`);
});