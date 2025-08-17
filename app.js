const express = require('express');
const app = express();
const mongoose = require("mongoose")
const path = require("path")
const methodOverride = require("method-override")
const ExpressError = require("./utils/ExpressError.js")
const wrapAsync = require("./utils/wrapAsync.js")
const ejsMate = require("ejs-mate")
const Course = require("./models/course.js")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const flash = require('connect-flash')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User = require("./models/user.js")
require("dotenv").config()

let mongoUrl = "mongodb://localhost:27017/PYQS"
let dbUrl = process.env.ATLASDB_URL
let port = process.env.PORT || 5000

async function connectMongoose(){
  
    await mongoose.connect(dbUrl)
}
connectMongoose().then(()=>{console.log("Connected successfully")}).catch((err)=>{console.log(err)})

const store = MongoStore.create({
  mongoUrl : dbUrl,
  crypto : {
    secret : "secretkeyofmywebsitevpath"
  },
  touchAfter : 24 * 3600,
})

store.on("error",()=>{
  console.log("Error in mongo section")
})

const sessionOptions = {   
  store,     
  secret : "mysecretcode",
  resave : false,
  saveUninitialized : false,
  cookie : {
      expires : Date.now() + 7 * 24 * 6 * 6 * 1000,
      maxAge : 7 * 24 * 6 * 6 * 1000,
      httpOnly : true
  }
}       

app.set("views",path.join(__dirname,"views"))
app.set("view engine","ejs")
app.use(express.static(path.join(__dirname,"public")))
app.use(express.urlencoded({extended : true}))
app.use(methodOverride("_method"))
app.engine("ejs",ejsMate)

app.use(session(sessionOptions))
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://vpath.onrender.com/auth/google/callback",
  scope : ["profile","email"]
},
async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;

  if (email.endsWith('@vitapstudent.ac.in')) {
    const user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      return done(null, user)
    };
  
    const newUser = await User.create({
      googleId: profile.id,
      email: email,
      name: profile.name.givenName,
    });

    return done(null, newUser);
  } else {
    return done(null, false, { message: "Unauthorized email domain" });
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

app.use((req,res,next)=>{
  res.locals.success = req.flash("success")
  res.locals.error = req.flash("error")
  res.locals.currUser = req.user;
  res.locals.currUserName = " ";
  if(req.user){
    res.locals.currUserName = req.user.name;
  }
  next()
})

const courses = require("./routes/courses.js")
const auth = require("./routes/auth.js")
app.use("/courses", courses)
app.use("/auth", auth)

app.use((req, res,next) => {
  res.redirect("/courses")
});

app.use((err,req,res,next)=>{
  let {status = 401 , message} = err;
  res.render("error.ejs",{message})
})

app.listen(port,"0.0.0.0",()=>{
  console.log("server started running")
})

