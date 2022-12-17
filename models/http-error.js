class HttpError extends Error{
    constructor(message,errorCode){
        super(message); //Add a message property tothis class
        this.code=errorCode;
    }
}

module.exports=HttpError;