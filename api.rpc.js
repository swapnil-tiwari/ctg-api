console.log('hi');
async function localize()
{
    var all=await rpc('getallroutes');
    var funcs={}
    for(let each of all)
        funcs[each]=(...args)=>rpc(each,...args);
     return funcs;   
}
async function rpc(proc,arg)
{
	  var req={
                method:arg?'POST':'GET',
                headers:{
                    'content-type': 'application/json'
                    },
                }
	arg?req.body=JSON.stringify(arg):null;
    var resp=await fetch('http://localhost:8080/data/'+proc,req);
    var js=await resp.json();
    if(js.code>=400)throw js;
    return js;
}
