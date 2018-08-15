const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8000 }, () => {
  console.log('listening on 8000');
});

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

var playersQueue = [];
function noop() {}

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', function connection(ws) {
    ws.id = wss.getUniqueID();
    ws.isAlive = true;
    ws.friend = "";
    ws.isQueue = true;
    playersQueue.push(ws);

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
                    console.log("Usr Login: " + ws.nickname);

                    wss.MatchAvailablePlayers();
                    break;

            }


        }else{
            // Mensaje directo
            // console.log("Msj Directo: " + message);
        }

        // for (var i = 0; i < clients.length; i++) {
        //
        //   if(clients[i].readyState === 1){
        //     clients[i].send(message);
        //   }
        // }
    });


    ws.on('close', function connection(client) {
        if(ws.isQueue){
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

        console.log("Conexion cerrada: " + ws.nickname);
        console.log();



        wss.MatchAvailablePlayers();
    });

});





const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000);
