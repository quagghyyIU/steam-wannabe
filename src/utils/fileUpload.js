const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (fileExt === '.png') {
        cb(null, true);
    } else {
        cb(new Error('Only .png files are allowed'), false);
    }
};

const upload = multer({ storage, fileFilter });
module.exports = upload;
