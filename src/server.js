// http 를 import
import http from "http";
// socket.io 를 import
import SocketIO from "socket.io";
// express 를 import
import express from "express";

// express 앱 구성
const app = express();

// 나중에 pug 페이지들을 렌더하기 위해 view engine 을 pug 로 설정
app.set("view engine", "pug");
// views 디렉토리 설정
app.set("views", __dirname + "/views");

// Express 에 template 이 어디 있는지 지정
// public url 을 생성해서 "/public" 으로 가게 되면 유저에게 public 폴더의 파일을 공유
app.use("/public", express.static(__dirname + "/public"));

// 홈페이지로 이동 시 사용될 템플릿 -> home.pug
// home.pug 페이지를 render 해주는 route handler 생성
app.get("/", (req, res) => res.render("home"));
// catchall url 생성
// 유저가 어떤 url 로 이동하던지 home 으로 가도록 함
app.get("/*", (req, res) => res.redirect("/"));

// express.js 를 이용하여 http 서버 생성
const httpServer = http.createServer(app);
// websocket 서버 생성
const wsServer = SocketIO(httpServer);

wsServer.on("connection", (socket) => {
  socket.on("enter_room", (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome");
  });

  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });

  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });

  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
