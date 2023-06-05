const express = require('express');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.DB_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const bodyParser = require('body-parser');
const cors = require('cors');
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());


const uri = `mongodb://${process.env.DB_user}:${process.env.DB_password}@ac-tfmdlv0-shard-00-00.rnkzyeb.mongodb.net:27017,ac-tfmdlv0-shard-00-01.rnkzyeb.mongodb.net:27017,ac-tfmdlv0-shard-00-02.rnkzyeb.mongodb.net:27017/?ssl=true&replicaSet=atlas-8cmvoo-shard-0&authSource=admin&retryWrites=true&w=majority`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


  const verifyToken = (req, res, next) =>{
        const authorized = req.headers.authorization;
        if(!authorized){
          return res.status(401).send({ error: true, message: "bhai unauthorized token" })
        }
        const token = authorized.split(" ")[1]
        jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
             if(err){
               return res.status(403).send({ error: true, message: "bhai forbidden token" })
             }
             req.decoded = decoded;
             next();
        })
  } 


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const menuCollection = client.db("restaurant").collection("category");
    const reviewCollection = client.db("restaurant").collection("reviews");
    const cartCollection = client.db("restaurant").collection("cart");
    const userCollection = client.db("restaurant").collection("users");
    const paymentCollection = client.db("restaurant").collection("payments");

    // jwt token
    app.post("/jwt", (req, res) =>{
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '1h' })
        res.send({token})
    })

    // verifyAdmin middleWare
    const verifyAdmin = async(req, res, next) =>{
        const email = req.decoded.email;
        const query = { email: email }
        const user = await userCollection.findOne(query)
        if (user?.role !== "admin"){
          return res.status(403).send({ error: true, message: "forbidden message" })
        }
        next();
    }

      // users related API POST
      app.post("/users", async(req,res) =>{
          const user = req.body;
         //  console.log(user)
          const query = { email: user.email }
          const existingUser = await userCollection.findOne(query);
         //  console.log("existing users", existingUser)
          if(existingUser){
             return res.send({ message: "user already exist" })
          }
          else{
           const result = await userCollection.insertOne(user);
           res.send(result)
          }
      })
 
      // users related API GET
      app.get("/users", verifyToken, verifyAdmin, async(req, res) =>{
         const result = await userCollection.find().toArray();
         res.send(result)
      })
 
       // users related API DELETE
       app.delete("/users/:id", async(req, res) =>{
         const id = req.params.id;
         console.log(id)
         const query = { _id: new ObjectId(id) };
         const result = await userCollection.deleteOne(query);
         res.send(result)
      })


    //users admin related API GET
    app.get("/users/admin/:email", verifyToken, async(req, res) =>{
       const email = req.params.email;

       if(req.decoded.email !== email){
            res.send({ admin: false })
       }

       const query = { email: email }
       const user = await userCollection.findOne(query);
       const result = { admin: user?.role === "admin" }
       res.send(result)
    })

     //  users related API UPDATE
     app.patch("/users/admin/:id", async(req, res) =>{
         const id = req.params.id;
         console.log(id)
         const filter = { _id: new ObjectId(id) }
         const updateDoc = {
             $set: {
                role: 'admin'
              },
         };
         const result = await userCollection.updateOne(filter, updateDoc);
         res.send(result);
     })

    // reviews related API GET
    app.get("/review", async(req, res) =>{
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })
    
    // menu related API POST
    app.post("/menu", verifyToken, verifyAdmin, async(req, res) =>{
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    })

    // menu related API GET
    app.get("/menu", async(req, res) =>{
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

     // menu id related API GET
     app.get("/menu/:id", async(req, res) =>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query);
      res.send(result);
    })

    // menu related API DELETE
    app.delete("/menu/:id", async(req, res) =>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

     // menu related API Put
     app.put("/menu/:id", async(req, res) =>{
      const id = req.params.id;
      const updateItem = req.body;
      // console.log(updateItem)
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
             name : updateItem.name,
             category : updateItem.category,
             image : updateItem.image,
             price : updateItem.price,
             recipe : updateItem.recipe
        },
      };
      const result = await menuCollection.updateOne(filter, updateDoc, options)
      res.send(result)

    })

    // cart related API POST
    app.post("/carts", async(req, res) =>{
        const item = req.body;
        console.log(item)
        const result = await cartCollection.insertOne(item)
        res.send(result)
    })

    // cart related API GET
    app.get("/carts", verifyToken, async(req, res) =>{
      const email = req.query.email;
      
      if(!email){
         res.send([])
      }

      const decodedEmail = req.decoded.email;

      if(email !== decodedEmail){
        return res.status(401).send({ error: true, message: "forbidden access" })
      }

      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
   })

    // cart related API DELETE
    app.delete("/carts/:id", async(req, res) =>{
       const id = req.params.id;
       const query = { _id: new ObjectId(id) };
       const result = await cartCollection.deleteOne(query);
       res.send(result)
    })

      // create payment intent POST
      app.post("/create-payment-intent", async (req, res) =>{
        const { price } = req.body;
        const amount = price*100;
        // console.log(price, amount)

        const paymentIntent = await stripe.paymentIntents.create({
              amount: amount,
              currency: "usd",
              payment_method_types: ["card"],
        })

        res.send({
              clientSecret: paymentIntent.client_secret
        })
      })

      // Store payment data POST
      app.post("/payments", verifyToken, async(req, res) =>{
          const payment = req.body;
          console.log(payment)
          const insertResult = await paymentCollection.insertOne(payment)

          const query = { _id: { $in: payment.cartItems.map(item => new ObjectId(item)) } }
          const deleteResult = await cartCollection.deleteMany(query)

          res.send({ insertResult, deleteResult })
      })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})