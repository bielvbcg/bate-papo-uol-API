import express from "express"
import cors from "cors"
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br.js';
import { MongoClient } from "mongodb"

const server = express()
server.use(express.json)
server.use(cors())

const mongoClient = new MongoClient("mongodb://localhost:27017")

server.post("/participants", async (req, res) => {
  try {
    await mongoClient.connect()
    const db = mongoClient.db("bate-papo-uol")
    const usuariosCollection = db.collection("usuarios")
    const mensagensCollection = db.collection("mensagens")

    await usuariosCollection.insertOne(
      {
        name: req.body.name,
        lastStatus: Date.now()
      })

    await mensagensCollection.insertOne(
      {
        from: req.body.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss")
      })

    res.sendStatus(201)
    mongoClient.close()

  } catch (error) {
    res.send(error)
    mongoClient.close()
  }
})


server.listen(5000)