import express from "express"
import cors from "cors"
import dayjs from 'dayjs';
import { MongoClient } from "mongodb"
import joi from "joi"

const server = express()
server.use(express.json())
server.use(cors())

let mongoClient = new MongoClient("mongodb://localhost:27017")

const usuarioSchema = joi.object({ name: joi.string().required() })

server.post("/participants", async (req, res) => {

  const validacao = usuarioSchema.validate(req.body, { abortEarly: false })
  if (validacao.error) {
    const erros = validacao.error.details.map(detail => detail.message)

    res.status(422).send(erros)
    return
  }

  try {
    await mongoClient.connect()
    const db = mongoClient.db("bate-papo-uol")
    const usuariosCollection = db.collection("usuarios")
    const mensagensCollection = db.collection("mensagens")

    let usuarioExistente = false
    const usuarios = await usuariosCollection.find({}).toArray()
    usuarios.map(item => { if (item.name === req.body.name) usuarioExistente = true })

    if (usuarioExistente) {
      res.sendStatus(409)
      mongoClient.close()
      return
    }

    await usuariosCollection.insertOne({ name: req.body.name, lastStatus: Date.now() })

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

server.get("/participants", async (req, res) => {
  try {
    await mongoClient.connect()
    const db = mongoClient.db("bate-papo-uol")
    const usuariosCollection = db.collection("usuarios")
    const usuarios = await usuariosCollection.find({}).toArray()

    res.status(200).send(usuarios)
    mongoClient.close()

  } catch (error) {
    res.sendStatus(500)
    mongoClient.close()
  }
})


server.listen(5000)