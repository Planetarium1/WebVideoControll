import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface CornerPoint {
  x: number;
  y: number;
}

interface GeometrySettings {
  videoName: string;
  topLeft: CornerPoint;
  topRight: CornerPoint;
  bottomLeft: CornerPoint;
  bottomRight: CornerPoint;
  brightness: number;
  contrast: number;
  saturation: number;
  rotation: number;
  scale: number;
}

export default function GeometryEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const [geometry, setGeometry] = useState<GeometrySettings>({
    videoName: "",
    topLeft: { x: 50, y: 50 },
    topRight: { x: 350, y: 50 },
    bottomLeft: { x: 50, y: 250 },
    bottomRight: { x: 350, y: 250 },
    brightness: 100,
    contrast: 100,
    saturation: 100,
    rotation: 0,
    scale: 100,
  });

  // Загрузка текущих настроек при инициализации компонента
  useEffect(() => {
    const fetchCurrentSettings = async () => {
      try {
        const response = await fetch("http://localhost:8000/settings");
        if (response.ok) {
          const currentSettings = await response.json();
          setGeometry(currentSettings);
        }
      } catch (error) {
        console.error("Failed to fetch current settings:", error);
      } finally {
        setIsSettingsLoaded(true);
      }
    };

    fetchCurrentSettings();
  }, []);

  // Функция для отправки настроек на сервер
  const updateSettingsOnServer = async (newGeometry: GeometrySettings) => {
    try {
      await fetch("http://localhost:8000/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGeometry),
      });
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  };

  // Обновленная функция setGeometry с отправкой на сервер
  const updateGeometry = (
    updates:
      | Partial<GeometrySettings>
      | ((prev: GeometrySettings) => GeometrySettings)
  ) => {
    setGeometry((prev) => {
      const newGeometry =
        typeof updates === "function" ? updates(prev) : { ...prev, ...updates };

      // Отправляем настройки на сервер только если они уже были загружены
      if (isSettingsLoaded) {
        updateSettingsOnServer(newGeometry);
      }

      return newGeometry;
    });
  };

  useEffect(() => {
    const fetchImages = async () => {
      const response = await fetch("http://localhost:8000/video-list");
      const data = await response.json();
      console.log(data);
      setAvailableImages(data.videos);
    };
    fetchImages();
  }, []);

  useEffect(() => {
    drawCanvas();
  }, [geometry, geometry.videoName, showGrid]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }

    // Draw corner points and lines
    drawCornerPoints(ctx);
    drawConnectingLines(ctx);
  };

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const drawCornerPoints = (ctx: CanvasRenderingContext2D) => {
    const corners = [
      { name: "topLeft", point: geometry.topLeft, color: "#ef4444" },
      { name: "topRight", point: geometry.topRight, color: "#3b82f6" },
      { name: "bottomLeft", point: geometry.bottomLeft, color: "#10b981" },
      { name: "bottomRight", point: geometry.bottomRight, color: "#f59e0b" },
    ];

    corners.forEach(({ point, color, name }) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Add label
      ctx.fillStyle = "#374151";
      ctx.font = "12px sans-serif";
      ctx.fillText(name, point.x + 12, point.y - 12);
    });
  };

  const drawConnectingLines = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(geometry.topLeft.x, geometry.topLeft.y);
    ctx.lineTo(geometry.topRight.x, geometry.topRight.y);
    ctx.lineTo(geometry.bottomRight.x, geometry.bottomRight.y);
    ctx.lineTo(geometry.bottomLeft.x, geometry.bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    ctx.setLineDash([]);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check which corner is being clicked
    const corners = [
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
    ] as const;

    for (const corner of corners) {
      const point = geometry[corner];
      const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);

      if (distance <= 12) {
        setIsDragging(corner);
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));

    updateGeometry((prev) => ({
      ...prev,
      [isDragging]: { x, y },
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const resetGeometry = () => {
    updateGeometry({
      topLeft: { x: 50, y: 50 },
      topRight: { x: 350, y: 50 },
      bottomLeft: { x: 50, y: 250 },
      bottomRight: { x: 350, y: 250 },
      brightness: 100,
      contrast: 100,
      saturation: 100,
      rotation: 0,
      scale: 100,
    });
  };

  useEffect(() => {
    if (!!geometry.videoName) {
      console.log(
        `Video from settings is in availableImages: ${
          availableImages.filter((e) => e === geometry.videoName).length > 0
        }`
      );
    }
  }, [geometry.videoName]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Geometry Editor
            </h1>
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Media Player
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="xl:col-span-1 space-y-6">
            {/* Image Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Image Selection
              </h3>
              <div className="space-y-3">
                {availableImages.map((image) => (
                  <button
                    key={image}
                    onClick={() =>
                      updateGeometry((prev) => ({ ...prev, videoName: image }))
                    }
                    className={`w-full flex justify-between p-3 text-left rounded-lg border transition-colors ${
                      geometry.videoName === image
                        ? "bg-green-50 border-green-300 text-red-900"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <p>{image.replace("/", "")}</p>
                    {geometry.videoName === image && (
                      <p className="text-green-500">selected</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Corner Coordinates */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Corner Coordinates
              </h3>
              <div className="space-y-4">
                {Object.entries(geometry)
                  .slice(1, 5)
                  .map(([corner, point]) => (
                    <div key={corner} className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {corner} X
                        </label>
                        <input
                          type="number"
                          value={Math.round(point.x)}
                          onChange={(e) =>
                            updateGeometry((prev) => ({
                              ...prev,
                              [corner]: {
                                ...(prev[
                                  corner as keyof GeometrySettings
                                ] as CornerPoint),
                                x: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {corner} Y
                        </label>
                        <input
                          type="number"
                          value={Math.round(point.y)}
                          onChange={(e) =>
                            updateGeometry((prev) => ({
                              ...prev,
                              [corner]: {
                                ...(prev[
                                  corner as keyof GeometrySettings
                                ] as CornerPoint),
                                y: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Image Adjustments */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Image Adjustments
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Brightness: {geometry.brightness}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={geometry.brightness}
                    onChange={(e) =>
                      updateGeometry({
                        brightness: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contrast: {geometry.contrast}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={geometry.contrast}
                    onChange={(e) =>
                      updateGeometry({
                        contrast: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Saturation: {geometry.saturation}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={geometry.saturation}
                    onChange={(e) =>
                      updateGeometry({
                        saturation: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rotation: {geometry.rotation}°
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={geometry.rotation}
                    onChange={(e) =>
                      updateGeometry({
                        rotation: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Scale: {geometry.scale}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={geometry.scale}
                    onChange={(e) =>
                      updateGeometry({
                        scale: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Controls
              </h3>
              <div className="space-y-3">
                <button
                  onClick={resetGeometry}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Reset Geometry
                </button>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="showGrid"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="rounded"
                  />
                  <label
                    htmlFor="showGrid"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Show Grid
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="showPreview"
                    checked={showPreview}
                    onChange={(e) => setShowPreview(e.target.checked)}
                    className="rounded"
                  />
                  <label
                    htmlFor="showPreview"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Show Preview
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Editor Canvas */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Geometry Editor Canvas
              </h3>
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={300}
                  className="border border-gray-300 rounded-lg cursor-crosshair bg-white"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  <p>• Drag the colored corner points to adjust geometry</p>
                  <p>
                    • Red: Top Left, Blue: Top Right, Green: Bottom Left,
                    Orange: Bottom Right
                  </p>
                </div>
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Live Preview (Pixi.js Geometric Deformation)
                </h3>
                <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg p-8 flex items-center justify-center min-h-[300px]">
                  <img src="http://localhost:8000/video" />
                </div>
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    This preview shows geometric deformation using Pixi.js mesh
                    transformation
                  </p>
                  <p>
                    The image is actually deformed to match the corner
                    positions, not just clipped
                  </p>
                </div>
              </div>
            )}

            {/* Show message when no image selected */}
            {showPreview && !geometry.videoName && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Live Preview
                </h3>
                <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg p-8 flex items-center justify-center min-h-[300px]">
                  <p className="text-gray-500 dark:text-gray-400">
                    Select an image to see the preview
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
