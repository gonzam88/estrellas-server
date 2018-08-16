// const WebSocket = require('ws');
const express = require('express');
const SocketServer = require('ws').Server;
const path = require('path');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

const server = express()
  .use((req, res) => res.sendFile(INDEX) )
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const wss = new SocketServer({ server });


wss.getUniqueID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};


wss.MatchAvailablePlayers = function(){

    if(playersQueue.length > 1){
        // Les aviso a playersQueue[0] y playersQueue[1] que juegan juntos
        playersQueue[0].friend = playersQueue[1];
        playersQueue[0].isQueue = false;

        playersQueue[1].friend = playersQueue[0];
        playersQueue[1].isQueue = false;

        // Data que le envio a cada uno
        let data = new Object();
        data.action = "newFriend";
        data.nickname = playersQueue[1].nickname;

        playersQueue[0].send( JSON.stringify(data) );
        data.nickname = playersQueue[0].nickname;
        playersQueue[1].send( JSON.stringify(data) );

        console.log("Se juntaron a dibujar " + playersQueue[0].nickname + " y " + playersQueue[1].nickname );
        playersQueue.splice(0, 2); // Elimino los elementos 0 y 1 del array

        // TODO Actualizo los paneles
        // for(let i = 0; i < paneles.length; i++){
        //     ActualizarPanel(paneles[i].id);
        // }
    }else{
        console.log("La queue está vacia");
    }
    console.log("Players en la Queue: " + playersQueue.length);
}

wss.UpdatePaneles = function(toOneClient = ""){
    var data = {
        action: "serverState",
        queueLength: playersQueue.length,
        playersInQueue: [],
        playersInRooms: []
    }
    var playersYaContados = [];

    wss.clients.forEach(function each(client) {
        if(!client.isPanel) {
            if(!playersYaContados.includes(client.id)) {
                if(client.isQueue){
                    data.playersInQueue.push( client.nickname + "("+ client.ip +")");
                }else{
                    data.playersInRooms.push( client.nickname  + "("+ client.ip +")" + " con " + client.friend.nickname  + "("+ client.ip +")" );
                    playersYaContados.push(client.friend.id);
                }
            }
        }
    });
    if(toOneClient == ""){
        for(let i =0; i < panelesClients.length; i++){
            panelesClients[i].send(JSON.stringify(data));
        }
    }else{
        console.log();
        console.log("Panel data enviado a " + toOneClient.nickname);
        toOneClient.send(JSON.stringify(data))
    }

}

var playersQueue = [];
var panelesClients = [];
function noop() {}

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', function connection(ws) {
    ws.id = wss.getUniqueID();
    ws.isAlive = true;
    ws.friend = "";
    ws.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    ws.on('pong', heartbeat);

    ws.on('message', function incoming(message) {
        // console.log('received: %s', message);
        let char = message.slice(0, 1);
        if(char == "[" || char == "{"){
            // Mensaje Json
            var data = JSON.parse(message);
            // console.log("Msj Json: ");
            // console.log(data);
            switch (data.action) {
                case "newCuerpo":
                    // Agrego un nuevo cuerpo espacial
                    if(ws.friend == "" || ws.isQueue) return;
                    ws.friend.send(message)
                    break;
                case "lookAt":
                    // Posicion donde está mirando (para señalar)
                    if(ws.friend == "" || ws.isQueue) return;
                    ws.friend.send(message)
                    break;

                case "login":
                    ws.nickname = data.nickname;
                    ws.role = data.role;
                    if(ws.role == "panel"){
                        panelesClients.push(ws);
                        ws.isPanel = true;
                    }else {
                        ws.isQueue = true;
                        playersQueue.push(ws);
                    }
                    console.log("Usr Login: " + ws.nickname);

                    wss.MatchAvailablePlayers();
                    wss.UpdatePaneles();
                    break;

                case "refreshPanel":
                    wss.UpdatePaneles(ws);
                    break;

            }


        }else{
            // Mensaje directo
            // console.log("Msj Directo: " + message);
        }
    });


    ws.on('close', function connection(client) {
        if(ws.role == "panel"){
            for(let i=0; i < panelesClients.length; i++){
                if(ws.id == panelesClients[i].id){
                    panelesClients.splice(i, 1);
                }
            }
        }else if(ws.isQueue){
            // Me fijo si este jugador sigue en la queue;
            for(let i=0; i < playersQueue.length; i++){
                if(ws.id == playersQueue[i].id){
                    // Lo saco de la queue
                    playersQueue.splice(i,1);
                }
            }
        }else{
            // Esta en un "Room". Le aviso al amigo que termino
            ws.friend.isQueue = true;
            playersQueue.push(ws.friend);
            // Le emito al amigo
            let data = new Object();
            data.action = "roomEnded";
            ws.friend.send( JSON.stringify(data) );
        }
        console.log();
        console.log("Conexion cerrada: " + ws.nickname);

        wss.MatchAvailablePlayers();
        wss.UpdatePaneles();
    });
});



// Ping pong
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000);
