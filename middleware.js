module.exports.isLoggedIn = (req,res,next)=>{
    if(!req.isAuthenticated()){
        // req.sesssion.redirectUrl = req.originalUrl;
        req.flash("error","You must be logged in to Upload")
        return res.redirect("/courses")
    }
    next()
}

module.exports.saveRedirectUrl = (req,res,next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl
    }
    next()
}