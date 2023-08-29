const express = require('express');
const app = express()
const axios = require('axios');
const ImageKit = require('imagekit');
require('dotenv').config();
const port = 3001

const imagekit = new ImageKit({
    publicKey: process.env.PUBLIC_KEY,
    privateKey: process.env.PRIVATE_KEY,
    urlEndpoint: process.env.URL_ENDPOINT
})

app.get('/api/calculate-distance',  async (req, res) => {
  try {
    const apiKey = process.env.MAPS_API_KEY;
    const userLocation = req.query.userLocation; // User's entered location
    const fixedPoint = '11 N Lincoln Avenue, Wenonah, NJ, USA';

    // Make a request to the Google Distance Matrix API
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        userLocation
      )}&destinations=${encodeURIComponent(
        fixedPoint
      )}&key=${apiKey}&units=imperial`
    );

    const distance = response.data.rows[0].elements[0].distance.text;

    res.json({ distance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.get('/api/autocomplete', async (req, res) => {
    try {
        const query = req.query.query;
        const apiKey = process.env.MAPS_API_KEY; // Replace with your API key
    
        // Make a request to the Google Places Autocomplete API
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&key=${apiKey}`
        );
    
        const suggestions = response.data.predictions.map((prediction) => ({
          description: prediction.description,
        }));
    
        res.json({ suggestions });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred' });
      }
})

app.get("/api/custom", (req, res) => {
    imagekit.listFiles({
        path: 'custom_caricatures'
    }, (error, result)=>{
        error ? res.status(500).json({error: "Error"}) : res.json(result);
    });
})

app.get("/api/illustrations", (req, res) => {
    imagekit.listFiles({
        path: 'illustrations'
    }, (error, result)=>{
        error ? res.status(500).json({error: "Error"}) : res.json(result);
    });
})

app.get("/api/party", (req, res) => {
    imagekit.listFiles({
        path: 'party_caricatures'
    }, (error, result)=>{
        error ? res.status(500).json({error: "Error"}) : res.json(result);
    });
})

app.get("/api/logos", (req, res) => {
    imagekit.listFiles({
        path: 'logos'
    }, (error, result)=>{
        error ? res.status(500).json({error: "Error"}) : res.json(result);
    });
})

app.listen(port, () => {
    console.log("Server Started on Port " + port);
})

app.use('/.netlify/functions/api', app)
module.exports.handler = serverless(app);