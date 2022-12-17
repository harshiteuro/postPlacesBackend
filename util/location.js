const axios=require('axios');
const HttpError = require('../models/http-error');

async function getCoordsForAddress(address){
    const response =await axios.get(`https://nominatim.openstreetmap.org/search.php?q=${encodeURIComponent(address)}&polygon_geojson=1&format=jsonv2`);
    if(!response){
        const error=new HttpError('Could not find location for the specified location',422);
        throw error;
    }
    const coordinates={
        lat:response.data[0].lat,
        lng:response.data[0].lon
    }
    return coordinates;
}
module.exports=getCoordsForAddress;