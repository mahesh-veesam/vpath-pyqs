const express = require("express")
const Course = require("../models/course.js")
const User = require("../models/user.js")
const router = express.Router()
const wrapAsync = require("../utils/wrapAsync.js")
const ExpressError = require("../utils/ExpressError.js")
const {isLoggedIn} = require("../middleware.js")
const multer = require('multer')
const { cloudinary } = require('../cloudConfig.js');
const PDFDocument = require('pdfkit');
const fs = require("fs")
const path = require("path")
const axios = require("axios")

const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
      const tempPath = path.join(__dirname, 'temp'); // Temp folder for initial storage
      if (!fs.existsSync(tempPath)) {
          fs.mkdirSync(tempPath, { recursive: true });
      }
      cb(null, tempPath); // Save to 'temp' folder initially
  },
  filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);  // Use timestamp for unique filename
  }
});

const upload = multer({ 
  limits : { fileSize : 6 * 1024 * 1024},
  storage: tempStorage
 });

router.get('/', wrapAsync(async(req, res) => {
  if(req.user) {
    console.log(req.user.name)
  }
    let courses = await Course.aggregate([
      {
        $group:{
          _id: "$code",
          title : { $first : "$title"}
        }
      }
    ])
    res.render("PYQs/index.ejs",{courses})
  }));
  
  router.get('/new',isLoggedIn,(req,res)=>{
    res.render("PYQs/new.ejs")
  })
  
  router.get('/:code',wrapAsync(async(req,res)=>{
    let {code} = req.params
    let courses = await Course.find({code : code}).populate("uploadedBy") 
    if (!courses){
        throw new ExpressError(404,"There is no Page")
    }
    res.render("PYQs/show.ejs",{courses})
  }))


router.post('/newCourse', upload.array('course[image]', 4), wrapAsync(async (req, res) => {

  console.log(req.files)

   // Check for no files uploaded or file size exceeded
   if (!req.files || req.files.length === 0) {
    const error = new Error("No files uploaded.");
    error.status = 400;
    return next(error);  // Pass the error to the error handling middleware
}

    let course = new Course(req.body.course);

    // Define the final upload folder for processed files
    const uploadFolderPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadFolderPath)) {
        fs.mkdirSync(uploadFolderPath, { recursive: true });
    }

    const tempFolderPath = path.join(__dirname, '../temp');

    // Step 1: Check if temp folder exists; if not, create it
    if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
    }

    // Step 2: Generate the PDF directly from local uploaded images
    const pdfPath = path.join(tempFolderPath, `${course._id}.pdf`);
    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    for (let file of req.files) {
        const imagePath = file.path; // local path

        const image = doc.openImage(imagePath);
        doc.addPage({ size: [image.width, image.height] });
        doc.image(image, 0, 0);
    }

    doc.end();

    // Step 3: Wait until PDF is fully written
    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    // Step 4: Upload the final PDF to Cloudinary
    const pdfUpload = await cloudinary.uploader.upload(pdfPath, { 
        resource_type: 'raw',
        public_id: `courses/${course._id}`,
        format: 'pdf'
    });

    // Step 5: Delete the temp PDF from local server
    fs.unlinkSync(pdfPath);

    // Step 6: Also delete the uploaded local images (optional cleanup)
    for (let file of req.files) {
        fs.unlink(file.path, (err) => {
            if (err) console.error(`Failed to delete ${file.path}`, err);
            else console.log(`Deleted temp image ${file.path}`);
        });
    }

    // Step 7: Save only PDF info inside course
    course.image = [];
    course.pdf = {
        url: pdfUpload.secure_url,
        filename: pdfUpload.public_id
    };

    course.uploadedBy = req.user._id;
    await course.save();

    req.flash('success', 'Uploaded Successfully');
    res.redirect('/courses');
}));
  
  
  router.get("/edit/:id",wrapAsync(async (req,res)=>{
    if(!res.locals.currUserName==="VEESAM MAHESH"){return res.redirect("/courses")}
    let {id} = req.params
    let course = await Course.findById(id)
    if (!course){
        throw new ExpressError(404,"There is no Page")
    }
    res.render("PYQs/edit.ejs",{course})
  }))
  
  router.patch("/:id",wrapAsync(async (req,res)=>{
    let {id} = req.params
    let {code,title,slot,examType,date,image} = req.body.course;
    await Course.findByIdAndUpdate(id, {code:code,title:title,slot:slot,examType:examType,date:date,image:image}, {runValidators:true , new : true})
    res.redirect("/courses")
  }))
  
  router.delete("/delete/:id",wrapAsync(async (req,res)=>{
    if(!res.locals.currUserName==="VEESAM MAHESH"){return res.redirect("/courses")}
    let {id} = req.params

    let course = await Course.findById(id)
    console.log("deleting",course)

    await cloudinary.uploader.destroy(course.pdf.filename,(error,result)=>{
      if(error){
        console.log("Error Deleting image",error)
      }
      else{
        console.log("Deleted Successfully image",result)
      }
    })

    await Course.findByIdAndDelete(id)
    req.flash("success","Deleted successfully")
    res.redirect("/courses")
  }))

  module.exports = router