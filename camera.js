const video = document.getElementById('video');
const statusElement = document.getElementById('status');

import {
  FilesetResolver,
  FaceLandmarker,
  VisionRunningMode,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js';

const video = document.getElementById('v');
const scoreEl = document.getElementById('score') || document.getElementById('score-val');
const hintEl = document.getElementById('hint-val') || document.getElementById('hint');

const TARGET = {
  jawOpen: 0.5,
  mouthSmileLeft: 0.7,
  mouthSmileRight: 0.7,
};

function cosineSimilarity(a, b) {
  const dot = a.reduce((s, v, i) => s + (v * (b[i] ?? 0)), 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (na === 0 || nb === 0) return 0;
  return dot / (na * nb);
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
}

async function createFaceLandmarker() {
  const wasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
  const fileset = await FilesetResolver.forVisionTasks(wasmUrl);

  const options = {
    baseOptions: { modelAssetPath: '/face_landmarker.task', filesetResolver: fileset },
    outputFaceBlendshapes: true,
    runningMode: VisionRunningMode.VIDEO,
    numFaces: 1,
  };

  return await FaceLandmarker.createFromOptions(options);
}

function extractBlendshapes(faceBlendshapes) {
  if (!faceBlendshapes || !faceBlendshapes.categories) return {};
  const out = {};
  for (const cat of faceBlendshapes.categories) {
    out[cat.categoryName] = cat.score;
  }
  return out;
}

async function main() {
  try {
    await startCamera();
  } catch (err) {
    if (hintEl) hintEl.textContent = 'Camera error: ' + err.message;
    return;
  }

  let landmarker;
  try {
    landmarker = await createFaceLandmarker();
  } catch (err) {
    if (hintEl) hintEl.textContent = 'Model load error: ' + err.message;
    return;
  }

  function onFrame(timestamp) {
    try {
      const result = landmarker.detectForVideo(video, timestamp);
      const faceBlend = (result && result.faceBlendshapes && result.faceBlendshapes[0]) || null;
      const blends = extractBlendshapes(faceBlend);

      const vecCurrent = [ (blends.jawOpen||0), (blends.mouthSmileLeft||0), (blends.mouthSmileRight||0) ];
      const vecTarget = [ (TARGET.jawOpen||0), (TARGET.mouthSmileLeft||0), (TARGET.mouthSmileRight||0) ];
      const cos = cosineSimilarity(vecCurrent, vecTarget);
      const score = Math.max(0, Math.min(1, cos));
      const percent = Math.round(score * 100);

      if (scoreEl) scoreEl.textContent = String(percent);
      if (hintEl) hintEl.textContent = faceBlend ? 'Face detected' : 'No face';
    } catch (err) {
      console.error('Frame error', err);
    }
    requestAnimationFrame(onFrame);
  }

  requestAnimationFrame(onFrame);
}

main();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frame = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const payload = {
      frame,
      timestamp: Date.now(),
    };

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, FRAME_INTERVAL_MS);
}

function stopSendingFrames() {
  if (sendInterval) {
    window.clearInterval(sendInterval);
    sendInterval = 0;
  }
}

window.addEventListener('load', async () => {
  try {
    await startCamera();
    connectWebSocket();
  } catch (error) {
    updateStatus(`Camera error: ${error.message}`, true);
  }
});
