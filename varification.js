var passwordHash = require('password-hash');
module.exports={generate:passwordHash.generate,varify:passwordHash.verify}