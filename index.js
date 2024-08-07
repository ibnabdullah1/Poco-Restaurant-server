const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
var jwt = require("jsonwebtoken");
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAIL_GUN_API_KEY,
});

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://poco-restaurant.web.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

//STRIPE_TEST_SECRET_KEY
const stripe = require("stripe")(`${process.env.STRIPE_TEST_SECRET_KEY}`);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rjnekog.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewCollection = client.db("bistroDb").collection("reviews");
    const cartCollection = client.db("bistroDb").collection("carts");
    const usersCollection = client.db("bistroDb").collection("users");
    const paymentCollection = client.db("bistroDb").collection("payments");
    const reservationCollection = client
      .db("bistroDb")
      .collection("reservations");

    // jwt related api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "3h",
      });

      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorized access " });
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access" });
        } else {
          req.decoded = decoded;
          next();
        }
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // users related api

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/orders", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.put("/orders/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Delivered",
        },
      };

      const result = await paymentCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/role", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const user = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: user.role,
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req?.decoded?.email) {
        res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    //menu related api
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);

      res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const result = await menuCollection.deleteOne({ _id: id });
      res.send(result);
    });

    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
          rating: item.rating,
        },
      };

      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });
    app.post("/reservation", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await reservationCollection.insertOne(bookingData);
      res.send(result);
    });
    app.get("/reservation/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await reservationCollection.find(query).toArray();
      res.send(result);
    });

    app.get(
      "/manage-bookings/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await reservationCollection.find().toArray();
        res.send(result);
      }
    );

    app.put(
      "/manage-bookings/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const status = req.body;
        console.log(req);
        const updateDoc = {
          $set: {
            status: status.status,
          },
        };
        const result = await reservationCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    app.get("/carts", async (req, res) => {
      const email = req.query.email;

      // if (!email) {
      //   res.send([]);
      // }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    //payment intended
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    // stats or analytics
    app.get("/admin_stats", async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();
      const totalRevenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({ users, menuItems, orders, totalRevenue });
    });

    app.get("/order_stats", async (req, res) => {
      try {
        const result = await paymentCollection
          .aggregate([
            { $unwind: "$menuItemIds" },
            {
              $lookup: {
                from: "menu",
                localField: "menuItemIds",
                foreignField: "_id",
                as: "menuItems",
              },
            },
            { $unwind: "$menuItems" },
            {
              $group: {
                _id: "$menuItems.category",
                quantity: {
                  $sum: 1,
                },
                totalRevenue: { $sum: "$menuItems.price" },
              },
            },
            {
              $project: {
                _id: 0,
                category: "$_id",
                quantity: "$quantity",
                totalRevenue: "$totalRevenue",
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching order stats:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    app.get("/top_sales_items", async (req, res) => {
      try {
        const menus = await menuCollection.find().toArray();
        const result = await paymentCollection
          .aggregate([
            { $unwind: "$menuItemIds" },
            {
              $lookup: {
                from: "menu",
                let: { menuItemId: { $toObjectId: "$menuItemIds" } },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$menuItemId"] } } },
                ],
                as: "menuItems",
              },
            },
            { $unwind: "$menuItems" },
            {
              $group: {
                _id: "$menuItems._id",
                itemName: { $first: "$menuItems.name" },
                price: { $first: "$menuItems.price" },
                quantitySold: { $sum: 1 },
                totalRevenue: { $sum: "$menuItems.price" },
              },
            },
            { $sort: { quantitySold: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                itemId: "$_id",
                itemName: "$itemName",
                price: "$price",
                quantitySold: "$quantitySold",
                totalRevenue: "$totalRevenue",
              },
            },
          ])
          .toArray();

        const topSalesItems = result.map((item) => {
          const menuItem = menus.find(
            (menu) => menu._id.toString() === item.itemId.toString()
          );
          return {
            ...item,
            image: menuItem ? menuItem.image : null,
          };
        });

        res.send(topSalesItems);
      } catch (error) {
        console.error("Error fetching top sales items:", error);
        res.status(500).send("Internal Server Error");
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Poco Restaurant is sitting");
});

app.listen(port, () => {
  console.log(`Poco Restaurant is sitting on port ${port}`);
});
