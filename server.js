const express = require("express");
const dotenv = require("dotenv");
const authRoutes = require("./src/routes/authRoutes");
const fileRoutes = require("./src/routes/fileRoutes");

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Route Definitions
app.use("/auth", authRoutes);
app.use("/files", fileRoutes);

// ✅ Start Server (only if not in testing mode)
const PORT = process.env.PORT || 5001;
let server = null;

if (require.main === module) {
  server = app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
  );
}

module.exports = { app, startServer: () => app.listen(0) };
