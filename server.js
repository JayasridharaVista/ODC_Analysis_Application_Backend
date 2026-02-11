const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// 👉 Import Routes
const dataRoutes = require("./routes/dataRoutes");

app.use("/api/data", dataRoutes);
app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database Connected Successfully",
      time: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Connection Failed");
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
