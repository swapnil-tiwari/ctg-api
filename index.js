var keyvar=require('./varification.js')
async function inititialize()
{
    const express=require('express');
    const path=require('path')
    const bson=require('bson')
    const session=require('express-session')
    var sess = {
        secret: 'macmac',
        cookie: {}
    }
    const app=express();
    const bodyParser=require('body-parser');
    app.use('/static',express.static(path.join(__dirname,'../CodeNova')));
    app.use(bodyParser.json({extended:false}));
    app.use(session(sess));
    const mongodb=require('mongodb').MongoClient;
    const client=await mongodb.connect("mongodb://localhost:27017")
    const ctgdb=client.db('ctg')
    const Userdb=ctgdb.collection('Userdb')
    const db={}
    db.getdoc=async function(query,filter={})
    {
        if(typeof query._id=='string')query._id=new bson.ObjectId(query._id);
        return Userdb.findOne(query,filter)
    }
    db.setdoc=async function setdoc(doc)
    {
        var result=await Userdb.insertOne(doc)
        return result.insertedId;
    }
    db.updatedoc=async function updatedoc(query,props)
    {
        var result=await Userdb.updateOne(query,props)
        return result.insertedId;
    }
    const response={}
    response.createRes=function createRes(code=500,res,data=null)
    {
        return{
            uri:res.req.uri,
            code,
            timestamp:Date.now(),
            data:Object.freeze(data)
        }
    }
    async function logout(req,res,next)
    {
        delete req.session.clientId;
        next();
    }
    response.report=function (code,res,err)
    {
        res.json(response.createRes(code,res,{detail:err}));
        res.end();
        throw err;
    }
    async function login(req,res,next)
    {
        if(typeof req.session.clientId =='string')
        {
            res.json(response.createRes(410,res,{detail:'already Logged in'}));
            res.end();
            return;
        }
        const username=req.body.username;//do some salt shit
        const password=req.body.password;//do some salt
        if(!username||!password)response.report(420,res,{detail:'illegal credentials'});
        var result=await db.getdoc({username,password},{_id:1}).catch((err)=>response.report(500,res,err));
        if(result&&result._id){
            req.session.clientId=String(result._id);
        }
        else response.report(420,res,{detail:'wrong credentials'});
            next();
    }
    async function islogin(req,res,next)
    {   
        res.json(response.createRes(200,res,{login:typeof req.session.clientId=='string',username:typeof req.session.clientId =='string'?(await db.getdoc({_id:req.session.clientId},{username:1,password:0})).username :null}));
        res.end();
        next();
    }
    const registrar={};
    registrar.varification=async function(props,res)
    {
        var uniques={
                    'fullname':{reg:/[a-zA-Z]{2,}/,uni:true},
                    'password':{reg:/^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})/,uni:false},
                    'username':{reg:/[a-zA-Z]{2,}/,uni:true},
                    'email':{reg:/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,uni:true},
                    'contact':{reg:/^(?:(?:\+|0{0,2})91(\s*[\ -]\s*)?|[0]?)?[789]\d{9}|(\d[ -]?){10}\d$/,unit:false},
                    'GSTIN':{reg:/\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}/,uni:true}
                };
        var problemWith={}
        async function vari(itemname,item,res)
        {
            if(!itemname)throw "no proceed"
            if(!item)return problemWith[itemname]='invalid'
            if(!uniques.hasOwnProperty(itemname))return 
            if(typeof item=='string'&&!item.match(uniques[itemname].reg))
            {
                problemWith[itemname]="invalid";
                return
            }
            if(!uniques[itemname].uni)return;
            var res=await db.getdoc({[itemname]:item}).catch((err)=>response.report(500,res,err))
            if(!res)
            {
                problemWith[itemname]="used";
            }
        }
        Object.keys(props).forEach(async(item)=>{await vari(item,props[item],res)})
        return problemWith
    }
    registrar.updateClient=async function(props,clientId,res)
    {
        var probs=await varification(props,res).catch((err)=>response.report(400,res,err));
        if(Object.keys(probs).length)response.report(400,res,probs);
        var dbadd=await updatedoc({_id:clientId},props).catch((err)=>response.report(400,res,err));
        return dbadd;
    }
    registrar.registerClient=async function(props,res)
    {
        
        var  username=props.username||"";
        var  password=props.password||"";
        var email=props.email||"";
        var contact=props.contact||"";
        var probs=await registrar.varification({username,password,email,contact},res).catch((err)=>response.report(400,res,err));
        if(Object.keys(probs).length)response.report(404,res,probs);
        password=keyvar.generate(password); //hashed password!
        var dbadd=await db.setdoc({username,password,email,contact}).catch((err)=>response.report(400,res,err));
        return dbadd
    }
    async function loginReq(req,res,next)
    {
        if(req.session.clientId)
        {
            next();
            return;
        }
        res.json(response.createRes(420,res,{err_auth:'login_required'}));
        res.end();
    }
    async function updateUser(req,res,next)
    {
        await registrar.updateClient(req.body,res).catch((err)=>response.report(450,res,err));
        next();
    }
    async function registerUser(req,res,next)
    {
        await registrar.registerClient(req.body,res).catch((err)=>response.report(450,res,err));
        res.json(response.createRes(200,res,{suc_auth:'Registed as :'+username}));
        res.end();
    }
    app.get('/data/islogin',islogin);
    app.get('/data/users',async function(req,res,next)
    {
        res.json(response.createRes(200,res,await db.getdoc({},{username:1})))
    })
    app.post('/data/login',login,islogin);
    app.get('/data/logout',logout,islogin);
    app.post('/data/register',registerUser);
    app.post('/data/register/update',loginReq,updateUser);
    app.listen(8080,function(){console.log('listening at port:',8080)});
}
inititialize();