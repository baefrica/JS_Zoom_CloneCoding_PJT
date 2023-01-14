// 사용자에게 보여지는 FE 에 사용되는 js 파일

// SocketIO 를 FE 와 연결
// io() 는 자동적으로 BE 의 socket.io 와 연결해주는 함수
// 알아서 socket.io 를 실행하고 있는 서버를 찾음
const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

const call = document.getElementById("call");
call.hidden = true;

// stream 을 받음
// stream : 비디오와 오디오가 결합됨
let myStream;
let muted = false; // 처음에 소리가 나는 상태로 시작
let cameraOff = false; // 처음에 카메라 킨 상태로 시작
let roomName;
let myPeerConnection;

async function getCameras() {
  try {
    // enumerateDevices() : 모든 장치와 미디어 장치를 알려줌
    const devices = await navigator.mediaDevices.enumerateDevices();
    // 비디오 입력만 찾을 것
    const cameras = devices.filter((device) => device.kind === "videoinput");
    console.log("cameras : ", cameras);

    // 현재 카메라 가져옴
    const currentCamera = myStream.getVideoTracks()[0];

    // cameras 배열에서
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      // 각 객체에서 deviceId 와 label 을 가져옴
      option.value = camera.deviceId;
      option.innerText = camera.label;

      // 카메라 option 이 현재 선택된 카메라와 같은 label 을 가지고 있다면
      // 그게 내가 사용하고 있는 카메라임
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }

      // option 들을 추가함
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  // 초기 constraints : device id 가 없을 때 실행, cameras 를 만들기 전
  const initialConstraints = {
    audio: true,
    video: {
      facingMode: "user",
    },
  };

  // device 가 있을 때 실행
  const cameraConstraints = {
    audio: false,
    video: {
      deviceId: {
        exact: deviceId,
      },
    },
  };

  try {
    // getUserMedia() : 유저의 카메라와 오디오를 가져옴
    myStream = await navigator.mediaDevices.getUserMedia(
      // deviceId 가 존재하면 cameraConstraints 사용
      // 만약 없다면 initialConstraints 사용
      deviceId ? cameraConstraints : initialConstraints
    );

    // myFace 안에 myStream 을 넣어줌
    myFace.srcObject = myStream;

    // deviceId 가 없다면 카메라를 가져옴 -> 처음에 getMedia() 할 때 딱 한번만 실행됨
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

// handleMuteClick() : 내가 클릭했을 때 음소거를 하고 텍스트를 바꿈
function handleMuteClick() {
  // 오디오 track 을 가짐 -> enabled 상태를 바꿔줌
  myStream.getAudioTracks().forEach((track) => {
    track.enabled = !track.enabled;
  });

  // 소리가 켜져있으면, 음소거 해제하라고 표시
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}

// handleCameraClick() : 내가 클릭했을 때 카메라를 끄고 텍스트를 바꿈
function handleCameraClick() {
  // 비디오 track 을 가짐 -> enabled 상태를 바꿔줌
  myStream.getVideoTracks().forEach((track) => {
    track.enabled = !track.enabled;
  });

  // 카메라가 꺼져있으면, 끄라고 표시
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}

// handleCameraChange() : 내가 선택한 카메라의 device id 를 받아옴
// 그걸 이용해서 stream 을 강제로 시작
async function handleCameraChange() {
  // getMedica() : 사용하려는 특정 카메라 id 를 전송
  await getMedia(camerasSelect.value);

  if (myPeerConnection) {
    // 바뀐 video track
    const videoTrack = myStream.getVideoTracks()[0];

    // kind 가 video 인 Sender 를 찾아서 getSenders()
    const videoSender = myPeerConnection.getSenders().find((sender) => {
      sender.track.kind === "video";
    });

    // Sender 를 videoTrack 으로 바꿔줌
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form 에 관한 코드 (enter room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

// media 를 가져가서 연결을 만들어주는 함수
async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();

  const input = welcomeForm.querySelector("input");

  // 방에 입장하기 전에 함수를 호출
  await initCall();

  socket.emit("enter_room", input.value);
  roomName = input.value; // 방 이름을 저장
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket 코드

// peer A 에서만 발생하는 코드
socket.on("welcome", async () => {
  console.log("someone joined ✔");

  // 다른 브라우저가 참가할 수 있도록 초대장을 만들고 있는 개념
  const offer = await myPeerConnection.createOffer();

  myPeerConnection.setLocalDescription(offer);
  console.log("Sent the offer");

  // offer 를 전송
  socket.emit("offer", offer, roomName);
});

// peer B 에서 발생할 코드
// offer 를 받음
socket.on("offer", async (offer) => {
  myPeerConnection.setRemoteDescription(offer);

  const answer = await myPeerConnection.createAnswer();

  myPeerConnection.setLocalDescription(answer);

  // answer 를 전송
  socket.emit("answer", answer, roomName);
  console.log("Sent the answer");
});

// answer 를 받음
// 다시 answer 를 peer A 로 보낸다는 개념
socket.on("answer", (answer) => {
  console.log("Received the answer");

  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("Received candidate");

  myPeerConnection.addIceCandidate(ice);
});

// RTC 코드

// 실제로 peer-to-peer 연결을 만드는 함수
// track 들을 개별적으로 추가해줌
function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    // stun 서버 발급
    iceServers: [
      { urls: ["stun:ntk-turn-2.xirsys.com"] },
      {
        username:
          "5ZHIWjQCbZsslt0O1yuKX9mAM1qUAnhBSvjyOOr9K0mAy7TNpdiyL0uubzKq7MaSAAAAAGPCjmhiYWVmcmljYQ==",
        credential: "8216822e-93fc-11ed-a742-0242ac120004",
        urls: [
          "turn:ntk-turn-2.xirsys.com:80?transport=udp",
          "turn:ntk-turn-2.xirsys.com:3478?transport=udp",
          "turn:ntk-turn-2.xirsys.com:80?transport=tcp",
          "turn:ntk-turn-2.xirsys.com:3478?transport=tcp",
          "turns:ntk-turn-2.xirsys.com:443?transport=tcp",
          "turns:ntk-turn-2.xirsys.com:5349?transport=tcp",
        ],
      },
    ],
  });
  // myPeerConnection 을 만들면, 즉시 그 event 를 listen
  myPeerConnection.addEventListener("icecandidate", handleIce);
  // myPeerConnection.addEventListener("addstream", handleAddStream);
  myPeerConnection.addEventListener("track", handleTrack);

  // audio 트랙 하나, video 트랙 하나 생김
  console.log(myStream.getTracks());

  // 양 쪽 브라우저에서 video, audio 데이터 stream 을 받아서 그것들을 연결 안에 집어넣음
  myStream.getTracks().forEach((track) => {
    myPeerConnection.addTrack(track, myStream);
  });
}

function handleIce(data) {
  // 서버로 candidate 를 보내자
  console.log("Sent candidate");

  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  console.log("Peer's Stream", data.stream);
  console.log("My Stream", myStream);

  const peerStream = document.getElementById("peerStream");
  peerStream.srcObject = data.stream;
}

function handleTrack(data) {
  console.log("handle track");
  const peerStream = document.getElementById("peerStream");
  peerStream.srcObject = data.streams[0];
}
