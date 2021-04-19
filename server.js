
var r = require('rethinkdbdash')({
    port: port
    username: 'admin',
    password: 'password',
    host: 'ip',
  });
  
const fetch = require('node-fetch');

let servermanager = {}

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }

servermanager.makeserver = async function (type) {

	let allocation;
	let usedport;

	// TODO - spread through multiple nodes
	// TODO - error checking in creation query

	// Fetch an available allocation
	let ports = await fetch('https://dev.thecookiemc.net/api/application/nodes/1/allocations', {
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': 'Bearer apitoken',
		}
	});

	let loopports = await ports.json()

	

	for(port in loopports.data) {

		if(loopports.data[port].attributes.assigned != true) {

			allocation = loopports.data[port].attributes.id
			usedip = loopports.data[port].attributes.ip
			usedport = loopports.data[port].attributes.port
			break;

		}
	}

	
		
	// create the server itself
	let result = await fetch('https://dev.thecookiemc.net/api/application/servers', {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': 'Bearer apitoken',
		},
		body: JSON.stringify({ "name": type.id, "user": 1, "egg": 15, "docker_image": "quay.io/pterodactyl/core:java", "startup": `java -Xms128M -Xmx${type.ram}M -jar server.jar`, "environment": { "CONFIG_NAME": type.id, "PAPER_VERSION": "1.8.8", "SERVER_JARFILE": "server.jar" }, "limits": { "memory": type.ram, "swap": 0, "disk": type.storage, "io": 500, "cpu": 100 }, "feature_limits": { "databases": 0, "backups": 0 }, "allocation": { "default": parseInt(allocation) }})
	});

	let resultjson = await result.json()

	console.log(`-=- ${resultjson.attributes.identifier} -=-`)
	console.log("IP: "+usedip+":"+usedport)

	// add to database

	let serverdb = {
		created: Date.now() / 1000,
		game: type.id,
		id: resultjson.attributes.identifier,
		ip: usedip+":"+usedport,
		joinable: false ,
		playercount: 0 ,
		state: "starting"
	}

	await r.db('InstanceManager').table('servers').insert(serverdb)

	// loop bungeecords
	let bungeelist = await r.db('InstanceManager').table('servers').filter({game: `bungee`})

	for(bungee in bungeelist) {

		let runcommand = await fetch(`https://dev.thecookiemc.net/api/client/servers/${bungeelist[bungee].id}/command`, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Authorization': 'Bearer apitoken',
		
			},
			body: JSON.stringify({ "command": `svm add ${serverdb.id} ${serverdb.ip}` })

		})

		if(!runcommand.ok) {
			console.log("error")
		}

	}

	

	// wait a few seconds
    await sleep(30000)

    try {
        let runcommand = await fetch(`https://dev.thecookiemc.net/api/client/servers/${resultjson.attributes.identifier}/power`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer apitoken',
        
            },
            body: JSON.stringify({ "signal": "start" })

        })
    } catch(e) {}
    

	// turn on the server
    return resultjson;
	
}

module.exports = servermanager;