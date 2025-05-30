import cv2
import threading
import time
import numpy as np
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Generator

origins = [
    "http://localhost.tiangolo.com",
    "https://localhost.tiangolo.com",
    "http://localhost",
    "http://localhost:3000",
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VIDEO_PATH = "test-video.mov"

# Получаем исходное разрешение видео при старте
cap = cv2.VideoCapture(VIDEO_PATH)
if not cap.isOpened():
    raise RuntimeError(f"Cannot open video: {VIDEO_PATH}")
ORIG_WIDTH = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
ORIG_HEIGHT = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
cap.release()
print(f"Native video size: {ORIG_WIDTH}×{ORIG_HEIGHT}")

latest_frame = None

# Глобальные текущие настройки трансформации
class CornerPoint(BaseModel):
    x: float
    y: float

class TransformSettings(BaseModel):
    topLeft: CornerPoint
    topRight: CornerPoint
    bottomRight: CornerPoint
    bottomLeft: CornerPoint
    brightness: float  # 0–200 (%)
    contrast: float    # 0–200 (%)
    saturation: float  # 0–200 (%)
    rotation: float    # в градусах
    # scale: float       # в процентах

current_settings: TransformSettings = TransformSettings(
    topLeft=CornerPoint(x=50, y=50),
    topRight=CornerPoint(x=350, y=50),
    bottomRight=CornerPoint(x=350, y=250),
    bottomLeft=CornerPoint(x=50, y=250),
    brightness=100, contrast=100, saturation=100, rotation=0, 
    # scale=100
)

def video_loop():
    global latest_frame
    while True:
        cap = cv2.VideoCapture(VIDEO_PATH)
        if not cap.isOpened():
            print("Error: Unable to open video file.")
            time.sleep(1)
            continue

        while True:
            success, frame = cap.read()
            if not success:
                break
            latest_frame = frame
            time.sleep(1/30)
        cap.release()

@app.on_event("startup")
def start_video_thread():
    thread = threading.Thread(target=video_loop, daemon=True)
    thread.start()

@app.post("/settings")
def update_settings(settings: TransformSettings):
    """Обновление текущих параметров трансформации."""
    global current_settings
    current_settings = settings
    return {"status": "ok"}

def apply_color_correction(img: np.ndarray, b: float, c: float, s: float) -> np.ndarray:
    """Применить яркость и контраст через convertScaleAbs."""
    alpha = c / 100.0
    beta = (b - 100)
    corrected = cv2.convertScaleAbs(img, alpha=alpha, beta=beta)
    return corrected

def mjpeg_streamer() -> Generator[bytes, None, None]:
    global latest_frame, current_settings
    while True:
        if latest_frame is None:
            time.sleep(0.01)
            continue

        frame = latest_frame.copy()
        # Используем фиксированное исходное разрешение
        w, h = ORIG_WIDTH, ORIG_HEIGHT

        # Собираем src и dst точки из текущих настроек
        src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        dst = np.float32([
            [current_settings.topLeft.x, current_settings.topLeft.y],
            [current_settings.topRight.x, current_settings.topRight.y],
            [current_settings.bottomRight.x, current_settings.bottomRight.y],
            [current_settings.bottomLeft.x, current_settings.bottomLeft.y],
        ])
        M = cv2.getPerspectiveTransform(src, dst)

        # Перспективная коррекция
        warped = cv2.warpPerspective(frame, M, (w, h))

        # Применяем цветокоррекцию
        warped = apply_color_correction(
            warped,
            current_settings.brightness,
            current_settings.contrast,
            current_settings.saturation
        )

        # Масштаб и поворот
        center = (w // 2, h // 2)
        rot_mat = cv2.getRotationMatrix2D(center, current_settings.rotation, 1)
                                        #   , current_settings.scale / 100.0
        warped = cv2.warpAffine(warped, rot_mat, (w, h))

        ret, buffer = cv2.imencode('.jpg', warped)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()
        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
        )
        time.sleep(1/30)

@app.get("/video")
def video_feed():
    return StreamingResponse(
        mjpeg_streamer(),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )
