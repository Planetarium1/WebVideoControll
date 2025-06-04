import cv2
import threading
import time
import numpy as np
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Generator
from contextlib import asynccontextmanager
import os

class CornerPoint(BaseModel):
    x: float
    y: float

class TransformSettings(BaseModel):
    videoName: str
    topLeft: CornerPoint
    topRight: CornerPoint
    bottomRight: CornerPoint
    bottomLeft: CornerPoint
    brightness: float  # 0–200 (%)
    contrast: float    # 0–200 (%)
    saturation: float  # 0–200 (%)
    rotation: float    # в градусах
    # scale: float       # в процентах

with open("settings.json", "r") as f:
    settings = json.load(f)
    current_settings = TransformSettings(
        videoName=settings["videoName"],
        topLeft=CornerPoint(x=settings["topLeft"]["x"], y=settings["topLeft"]["y"]),
        topRight=CornerPoint(x=settings["topRight"]["x"], y=settings["topRight"]["y"]),
        bottomRight=CornerPoint(x=settings["bottomRight"]["x"], y=settings["bottomRight"]["y"]),
        bottomLeft=CornerPoint(x=settings["bottomLeft"]["x"], y=settings["bottomLeft"]["y"]),
        brightness=settings["brightness"],
        contrast=settings["contrast"],
        saturation=settings["saturation"],
        rotation=settings["rotation"],
    )

origins = [
    "http://localhost.tiangolo.com",
    "https://localhost.tiangolo.com",
    "http://localhost",
    "http://localhost:3000",
]

# Получаем исходное разрешение видео при старте
cap = cv2.VideoCapture(f"./videos/{current_settings.videoName}")
if not cap.isOpened():
    raise RuntimeError(f"Cannot open video: {current_settings.videoName}")
ORIG_WIDTH = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
ORIG_HEIGHT = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
cap.release()
print(f"Native video size: {ORIG_WIDTH}×{ORIG_HEIGHT}")

latest_frame = None
video_restart_event = threading.Event()

# Глобальные текущие настройки трансформации

def video_loop(stop_thread):
    global latest_frame, current_settings, ORIG_WIDTH, ORIG_HEIGHT
    current_video_name = current_settings.videoName
    
    while True: 
        if stop_thread():
            break
            
        # Проверяем, нужно ли перезапустить видео
        if video_restart_event.is_set() or current_video_name != current_settings.videoName:
            current_video_name = current_settings.videoName
            video_restart_event.clear()
            print(f"Switching to video: {current_video_name}")
            
            # Обновляем размеры для нового видео
            cap_temp = cv2.VideoCapture(f"./videos/{current_video_name}")
            if cap_temp.isOpened():
                ORIG_WIDTH = int(cap_temp.get(cv2.CAP_PROP_FRAME_WIDTH))
                ORIG_HEIGHT = int(cap_temp.get(cv2.CAP_PROP_FRAME_HEIGHT))
                cap_temp.release()
                print(f"New video size: {ORIG_WIDTH}×{ORIG_HEIGHT}")
        
        cap = cv2.VideoCapture(f"./videos/{current_video_name}")
        if not cap.isOpened():
            print(f"Error: Unable to open video file: {current_video_name}")
            time.sleep(1)
            continue

        while True:
            # Проверяем, нужно ли сменить видео
            if current_video_name != current_settings.videoName or video_restart_event.is_set():
                break
                
            if stop_thread():
                break
                
            success, frame = cap.read()
            if not success:
                break
            latest_frame = frame
            time.sleep(1/30)
        cap.release()

@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_thread = False
    thread = threading.Thread(target=video_loop, daemon=True, args=(lambda: stop_thread,)) 
    thread.start()
    yield
    stop_thread = True
    thread.join()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# @app.on_event("startup")
# def start_video_thread():
#     thread = threading.Thread(target=video_loop, daemon=True)
#     thread.start()

@app.get("/settings")
def get_settings():
    return current_settings.model_dump()

@app.post("/settings")
def update_settings(settings: TransformSettings):
    """Обновление текущих параметров трансформации."""
    global current_settings
    
    # Проверяем, изменилось ли название видео
    video_changed = current_settings.videoName != settings.videoName
    
    current_settings = settings
    with open("settings.json", "w") as f:
        json.dump(settings.model_dump(), f)
    
    # Если видео изменилось, сигнализируем о необходимости перезапуска
    if video_changed:
        video_restart_event.set()
    
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
        
        # Вычисляем границы трансформированного изображения
        min_x = int(min(dst[:, 0]))
        max_x = int(max(dst[:, 0]))
        min_y = int(min(dst[:, 1]))
        max_y = int(max(dst[:, 1]))
        
        # Определяем размер выходного изображения
        output_width = max_x - min_x
        output_height = max_y - min_y
        
        # Корректируем точки назначения с учетом смещения
        dst_corrected = dst.copy()
        dst_corrected[:, 0] -= min_x
        dst_corrected[:, 1] -= min_y
        
        M = cv2.getPerspectiveTransform(src, dst_corrected)

        # Перспективная коррекция с правильным размером
        warped = cv2.warpPerspective(frame, M, (output_width, output_height))

        # Применяем цветокоррекцию
        warped = apply_color_correction(
            warped,
            current_settings.brightness,
            current_settings.contrast,
            current_settings.saturation
        )

        # Масштаб и поворот относительно центра нового изображения
        center = (output_width // 2, output_height // 2)
        rot_mat = cv2.getRotationMatrix2D(center, current_settings.rotation, 1)
        warped = cv2.warpAffine(warped, rot_mat, (output_width, output_height))

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

@app.get("/video-list")
def video_list():
    return {"videos": os.listdir("./videos")}
