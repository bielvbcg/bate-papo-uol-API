import express from "express"
import cors from "cors"
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from "mongodb"
import joi from "joi"
import { stripHtml } from "string-strip-html";
import dotenv from "dotenv";

const server = express()
server.use(express.json())
server.use(cors())
dotenv.config();

let db;
let usuariosCollection;
let mensagensCollection;

const mongoClient = new MongoClient(process.env.MONGO_URI)
mongoClient.connect().then(async () => {
  db = mongoClient.db("bate-papo-uol-3")
  usuariosCollection = db.collection("usuarios")
  mensagensCollection = db.collection("mensagens")
})

const usuarioSchema = joi.object({ name: joi.string().required() })
const mensagensSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.any().valid("message", "private_message")
})

setInterval(async () => {

  try {
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
  } catch (error) {
    console.log(error.message)
  }
}, 15000)

server.post("/participants", async (req, res) => {

  const validacao = usuarioSchema.validate(req.body, { abortEarly: false })
  if (validacao.error) {
    const erros = validacao.error.details.map(detail => detail.message)

    res.status(422).send(erros)
    return
  }


  try {
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

  } catch (error) {
    res.send(error)
  }
})

server.get("/participants", async (req, res) => {
  try {
    const usuarios = await usuariosCollection.find({}).toArray()

    res.status(200).send(usuarios)

  } catch (error) {
    res.sendStatus(500)
  }
})

server.post("/messages", async (req, res) => {

  const validacao = mensagensSchema.validate(req.body, { abortEarly: false })
  if (validacao.error) {
    const erros = validacao.error.details.map(detail => detail.message)

    res.status(422).send(erros)
    return
  }

  try {
    let usuarioEncontrado = false
    const usuarios = await usuariosCollection.find({}).toArray()
    usuarios.map(item => { if (item.name === req.headers.user) usuarioEncontrado = true })

    if (!usuarioEncontrado) {
      res.sendStatus(422)
      mongoClient.close()
      return
    }

    const mensagem = {
      to: stripHtml(req.body.to).result.trim(),
      text: stripHtml(req.body.text).result.trim(),
      type: stripHtml(req.body.type).result.trim()
    }

    await mensagensCollection.insertOne({
      from: req.headers.user,
      ...mensagem,
      time: dayjs().format("HH:mm:ss")
    })

    res.sendStatus(201)

  } catch (error) {
    res.status(500).send(error.message)
  }
})

server.get('/messages', async (req, res) => {
  try {
    let mensagens = await mensagensCollection.find({}).toArray()
    const usuario = req.headers.user

    mensagens = mensagens.filter(({ type, from, to }) => type !== "private_message" || from === usuario || to === usuario || to === "Todos")

    const limite = parseInt(req.query.limit)
    if (limite) mensagens = mensagens.slice(0, limite)

    res.status(200).send(mensagens)

  } catch (error) {
    res.status(500).send(error.message)
  }
})

server.post("/status", async (req, res) => {
  try {
    const usuarios = await usuariosCollection.find({}).toArray()

    let usuarioEncontrado = false
    usuarios.map(item => { if (item.name === req.headers.user) usuarioEncontrado = true })
    if (!usuarioEncontrado) {
      res.sendStatus(404)
      return
    }

    await usuariosCollection.updateOne(
      { name: req.headers.user },
      { $set: { lastStatus: Date.now() } }
    )

    res.sendStatus(200)

  } catch (error) {
    res.status(500).send(error.message)
  }
})

server.delete("/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const mensagem = await mensagensCollection.findOne({ _id: new ObjectId(id) })

    if (!mensagem) {
      res.sendStatus(404)
    }
    if (mensagem.from !== req.headers.user) {
      res.sendStatus(401)
    }

    await mensagensCollection.deleteOne({ _id: new ObjectId(id) })

    res.sendStatus(200)

  } catch (error) {
    res.status(500).send(error.message)
  }
})

server.listen(5000)