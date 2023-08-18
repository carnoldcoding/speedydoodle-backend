const express = require('express');
const app = express()
const ImageKit = require('imagekit');
require('dotenv').config();
const port = 3001

const imagekit = new ImageKit({
    publicKey: process.env.PUBLIC_KEY,
    privateKey: process.env.PRIVATE_KEY,
    urlEndpoint: process.env.URL_ENDPOINT
})

app.get("/api/custom", (req, res) => {
    imagekit.listFiles({
        tags : ["custom"]
    }, (error, result)=>{
        error ? res.status(500).json({error: "Error"}) : res.json(result);
    });
})

app.get("/api/illustrations", (req, res) => {
    imagekit.listFiles({
        tags : ["illustrations"]
    }, (error, result)=>{
        error ? res.status(500).json({error: "Error"}) : res.json(result);
    });
})

app.get("/api/party", (req, res) => {
    imagekit.listFiles({
        tags : ["party"]
    }, (error, result)=>{
        error ? res.status(500).json({error: "Error"}) : res.json(result);
    });
})

app.get("/api/logos", (req, res) => {
    imagekit.listFiles({
        tags : ["logos"]
    }, (error, result)=>{
        error ? res.status(500).json({error: "Error"}) : res.json(result);
    });
})

app.listen(port, () => {
    console.log("Server Started on Port " + port);
})