import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

env.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
});

db.connect()
  .then(() => console.log("Connected to the database"))
  .catch((err) => console.error("Connection error", err.stack));

app.get("/", async (req, res) => {
  try {
    const items = await db.query("SELECT * FROM list_items ORDER BY id LIMIT 50");
    res.json({ listTitle: "Today", listItems: items.rows });
  } catch (err) {
    console.error("Database fetch error:", err);
    res.status(500).send("Database error");
  }
});

app.post("/add", async (req, res) => {
  const item = req.body.newItem;
  await db.query("INSERT INTO list_items(title) VALUES ($1)", [item]);
  res.redirect("/");
});

app.post("/edit", async (req, res) => {
  const item_id = req.body["updatedItemId"];
  const new_message = req.body["updatedItemTitle"];
  await db.query("UPDATE list_items SET title=$1 WHERE id=$2", [new_message, item_id]);
  res.redirect("/");
});

app.post("/delete", async (req, res) => {
  const itemto_delete = req.body["deleteItemId"];
  await db.query("DELETE FROM list_items WHERE id=$1", [itemto_delete]);
  res.redirect("/");
});

// 🚀 Export the app for Vercel (No app.listen)
export default app;
