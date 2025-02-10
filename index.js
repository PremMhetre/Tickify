import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 3000;
env.config();

const db=new pg.Client(
  {
    user : process.env.DB_USER,
    host : process.env.DB_HOST,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_DATABASE,
    port :  process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } 
  }
);

db.connect()
  .then(() => console.log("Connected to the database"))
  .catch((err) => console.error("Connection error", err.stack));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.get("/", async(req, res) => {
  const items = await db.query("select * from list_items order by id");
  res.render("index.ejs", {
    listTitle: "Today",
    listItems: items.rows,
  });
});

app.post("/add", async(req, res) => {
  const item = req.body.newItem;
  await db.query("insert into list_items(title) values ($1)",[item]);
  res.redirect("/");
});

app.post("/edit", async(req, res) => {
  const item_id=req.body["updatedItemId"];
  const new_message=req.body["updatedItemTitle"];
  await db.query("update list_items set title=$1 where id=$2",[new_message,item_id]);
  console.log(req.body);
  res.redirect("/");
});

app.post("/delete", (req, res) => {
  const itemto_delete=req.body["deleteItemId"];
  db.query("delete from list_items where id=$1",[itemto_delete]);
  console.log(req.body);
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});