const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require("../models/user.js")
const {saveRedirectUrl} = require("../middleware.js")

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', saveRedirectUrl,
  passport.authenticate('google', { failureRedirect: '/courses', failureFlash : true }),
  async(req, res) => {
    req.flash("success",`Welcome to VPATH , ${req.user.name}`)
    let redirectUrl = res.locals.redirectUrl || "/courses"
    console.log(redirectUrl)
    res.redirect(redirectUrl);
  }
);

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if(err) {return next(err)}
    req.flash("success","You Logged out!")
    res.redirect("/courses")
  });
});

module.exports = router;