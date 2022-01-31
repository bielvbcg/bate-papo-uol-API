import express from "express"
import cors from "cors"
import dayjs from 'dayjs';
import { MongoClient } from "mongodb"
import joi from "joi"
import { stripHtml } from "string-strip-html";

const server = express()
server.use(express.json())
server.use(cors())

const usuarioSchema = joi.object({ name: joi.string().required() })
const mensagensSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.any().valid("message", "private_message")
})

setInterval(async () => {
  const mongoClient = new MongoClient("mongodb://localhost:27017")

  try {
    await mongoClient.connect()
    const db = mongoClient.db("bate-papo-uol-2")
    const usuariosCollection = db.collection("usuarios")
    const mensagensCollection = db.collection("mensagens")
    const usuarios = await usuariosCollection.find({}).toArray()

    for (let i = 0; i < usuarios.length; i++) {

      if (Date.now() - usuarios[i].lastStatus > 10000) {

        await usuariosCollection.deleteOne({ name: usuarios[i].name })
        await mensagensCollection.insertOne(
          {
            from: usuarios[i].name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss")
          })
      }
    }
    mongoClient.close()

  } catch (error) {
    console.log(error.message)
    mongoClient.close()
  }
}, 15000)

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
    const db = mongoClient.db("bate-papo-uol-2")
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

    await usuariosCollection.insertOne({ name: stripHtml(req.body.name).result.trim(), lastStatus: Date.now() })

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
    const db = mongoClient.db("bate-papo-uol-2")
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

  const validacao = mensagensSchema.validate(req.body, { abortEarly: false })
  if (validacao.error) {
    const erros = validacao.error.details.map(detail => detail.message)

    res.status(422).send(erros)
    return
  }

  const mongoClient = new MongoClient("mongodb://localhost:27017")

  try {
    await mongoClient.connect()
    const db = mongoClient.db("bate-papo-uol-2")
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

    console.log(stripHtml(req.body.text).result.trim())

    const mensagem = stripHtml(req.body.text).result.trim()

    await mensagensCollection.insertOne({
      from: req.headers.user,
      to: req.body.to,
      text: mensagem,
      type: req.body.type,
      time: dayjs().format("HH:mm:ss")
    })

    res.sendStatus(201)
    mongoClient.close()

  } catch (error) {
    res.status(500).send(error.message)
    mongoClient.close()
  }
})

server.get('/messages', async (req, res) => {
  const mongoClient = new MongoClient("mongodb://localhost:27017")

  try {
    await mongoClient.connect()
    const db = mongoClient.db("bate-papo-uol-2")
    const mensagensCollection = db.collection("mensagens")
    let mensagens = await mensagensCollection.find({}).toArray()
    const usuario = req.headers.user

    mensagens = mensagens.filter(({ type, from, to }) => type !== "private_message" || from === usuario || to === usuario || to === "Todos")

    const limite = parseInt(req.query.limit)
    if (limite) mensagens = mensagens.slice(0, limite)

    res.status(200).send(mensagens)
    mongoClient.close()

  } catch (error) {
    res.status(500).send(error.message)
    mongoClient.close()
  }
})

server.post("/status", async (req, res) => {

  const mongoClient = new MongoClient("mongodb://localhost:27017")

  try {
    await mongoClient.connect()
    const db = mongoClient.db("bate-papo-uol-2")
    const usuariosCollection = db.collection("usuarios")
    const usuarios = await usuariosCollection.find({}).toArray()

    let usuarioEncontrado = false
    usuarios.map(item => { if (item.name === req.headers.user) usuarioEncontrado = true })
    if (!usuarioEncontrado) {
      res.sendStatus(404)
      mongoClient.close()
      return
    }

    await usuariosCollection.updateOne(
      { name: req.headers.user },
      { $set: { lastStatus: Date.now() } }
    )

    res.sendStatus(200)
    mongoClient.close()

  } catch (error) {
    res.status(500).send(error.message)
    mongoClient.close()
  }
})

server.listen(5000)