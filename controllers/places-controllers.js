const fs=require('fs');
const {validationResult}=require('express-validator');
const HttpError=require('../models/http-error');
const getCoordsForAddress=require('../util/location');
const Place=require('../models/place');
const User=require('../models/user');
const { default: mongoose } = require('mongoose');

const getPlaceById=async (req,res,next)=>{
    const placeId=req.params.pid;
    let place;
    try{
        place=await Place.findById(placeId);
    }
    catch(err){
        const error=new HttpError(
            'Something went wrong, could not find a place',500
        );
        return next(error);
    }
    
    if(!place){
        const error=new HttpError('Could not find a place for the provided id',404);
        return next(error);
    }
    res.json({
        place:place.toObject({getters:true})
    });
}

const getPlacesByUserId=async (req,res,next)=>{
    const userId=req.params.uid;
    let userPlaces;
    try{
        // places=await Place.find({creator:userId});
        //using populate
        userPlaces=await User.findById(userId).populate('places');

    }
    catch(err){
        const error=new HttpError('Fetching places failed, please try again later',500);
        return next(error);
    }
   
    if(!userPlaces || userPlaces.places.length===0){
        return next(new HttpError('Could not find a places for the provided id',404));
    }
    res.json({
        places:userPlaces.places.map(place=>place.toObject({getters:true}))
    })
}

const createPlace=async (req,res,next)=>{
    const errors=validationResult(req);
    if(!errors.isEmpty()){
       return next(new HttpError('Invalid inputs passed, please check your data',422));
    }
    const {title,description,address}=req.body;
    let coordinates;
    try{
        coordinates=await getCoordsForAddress(address);
    }catch(error){
        return next(error);
    }
    const createdPlace=new Place({
        title,
        description,
        address,
        location:coordinates,
        image:req.file.path,
        creator:req.userData.userId
    });

    let user;
    try{
        user=await User.findById(req.userData.userId);
    }catch(err){
        const error=new HttpError('Creating place failed, Please try again',500);
        return next(error);
    }

    if(!user){
        const error=new HttpError('Could not find user for provided id',404);
        return next(error);
    }

    try{
        const sess=await mongoose.startSession();
        sess.startTransaction();
        await createdPlace.save({session:sess});
        user.places.push(createdPlace);
        await user.save({session:sess});
        await sess.commitTransaction();
    }
    catch(err){
        const error=new HttpError(
            'Creating place failed, please try again',
            500
        );
        return next(error);
    }
   
    res.status(201).json({place:createdPlace});
};

const updatePlace=async (req,res,next)=>{
    const errors=validationResult(req);
    if(!errors.isEmpty()){
        return next(new HttpError('Invalid inputs passed, please check your data',422));
    }
    const {title,description}=req.body;
    const placeId=req.params.pid;

    let place;
    try{
        place=await Place.findById(placeId);
    }
    catch(err){
        const error=new HttpError('Something went wrong, we could not update place',500);
        return next(error);
    }

    //spread op we use to create a new obj to work with the copy of data
    // const updatedPlace={...DUMMY_PLACES.find(p=>p.id===placeId)};


    if(place.creator.toString()!==req.userData.userId){
        const error=new HttpError('You are not allowed to edit this place',401);
        return next(error);
    }

    // const placeIndex=DUMMY_PLACES.findIndex(p=>p.id===placeId);
    place.title=title;
    place.description=description;

    try{
        await place.save();
    }catch(err){
        const error=new HttpError('Something went wrong, we could not update place',500);
        return next(error);
    }

    return res.status(200).json({place:place.toObject({getters:true})});
}

const deletePlace=async (req,res,next)=>{
    const placeId=req.params.pid;

    let place;
    try{
        //populate method used when two coll have relation and we want to search something
        place=await Place.findById(placeId).populate('creator');
    }
    catch(err){
        const error=new HttpError('Something went wrong, could not delete place',500);
        return next(error);
    }

    if(!place){
        const error=new HttpError('Could not find place for this id',404);
        return next(error);
    }

    if(place.creator.id!==req.userData.userId){
        const error=new HttpError('You are not allowed to delete this place',401);
        return next(error);
    }

    const imagePath=place.image;


    try{
        //transaction--rollback
        const sess=await mongoose.startSession();
        sess.startTransaction();
        await place.remove({session:sess});
        //remove place from user places array
        place.creator.places.pull(place);
        await place.creator.save({session:sess});
        await sess.commitTransaction();
    }catch(err){
        const error=new HttpError('Something went wrong, could not delete place',500);
        return next(error);
    }
    
    fs.unlink(imagePath,err=>{
        console.log(err);
    });

    return res.status(200).json({
        message:'Deleted place'
    })
}

exports.getPlaceById=getPlaceById;
exports.getPlacesByUserId=getPlacesByUserId;
exports.createPlace=createPlace;
exports.updatePlace=updatePlace;
exports.deletePlace=deletePlace;