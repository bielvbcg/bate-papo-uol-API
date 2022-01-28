import express from "express"
import cors from "cors"
import dayjs from 'dayjs';
import { MongoClient } from "mongodb"
import joi from "joi"

const server = express()
server.use(express.json())
server.use(cors())

const usuarioSchema = joi.object({ name: joi.string().required() })
const mensagensSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.any().valid("message", "private_message")
})

server.post("/participants", async (req, res) => {

  const validacao = usuarioSchema.validate(req.body, { abortEarly: false })
  if (validacao.error) {
    const erros = validacao.error.details.map(detail => detail.message)

    res.status(422).send(erros)
    return
  }

  const mongoClient = new MongoClient("mongodb://localhost:27017")

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
  const mongoClient = new MongoClient("mongodb://localhost:27017")

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

server.post("/messages", async (req, res) => {
  console.log(req.body)
  console.log(req.headers.user)

  const validacao = mensagensSchema.validate(req.body, { abortEarly: false })
  if (validacao.error) {
    const erros = validacao.error.details.map(detail => detail.message)

    res.status(422).send(erros)
    return
  }

  const mongoClient = new MongoClient("mongodb://localhost:27017")

  try {
    await mongoClient.connect()
    const db = mongoClient.db("bate-papo-uol")
    const usuariosCollection = db.collection("usuarios")
    const mensagensCollection = db.collection("mensagens")

    let usuarioEncontrado = false
    const usuarios = await usuariosCollection.find({}).toArray()
    usuarios.map(item => { if (item.name === req.headers.user) usuarioEncontrado = true })

    if (!usuarioEncontrado) {
      res.sendStatus(422)
      mongoClient.close()
      return
    }

    await mensagensCollection.insertOne({
      from: req.headers.user,
      to: req.body.to,
      text: req.body.text,
      type: req.body.type,
      time: dayjs().format("HH:mm:ss")
    })

    res.sendStatus(201)
    mongoClient.close()

  } catch (error) {
    res.sendStatus(500)
    mongoClient.close()
  }
})

server.listen(5000)