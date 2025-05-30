import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import * as PIXI from "pixi.js";

interface CornerPoint {
  x: number;
  y: number;
}

interface GeometrySettings {
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

function PixiPreview({
  imageSrc,
  geometry,
  width = 400,
  height = 300,
}: {
  imageSrc: string | null;
  geometry: GeometrySettings;
  width?: number;
  height?: number;
}) {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const containerRef = useRef<PIXI.Container | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Функция для вычисления перспективной трансформации
  const calculatePerspectiveTransform = (
    corners: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    },
    imageWidth: number,
    imageHeight: number
  ) => {
    // Исходные координаты изображения (прямоугольник)
    const src = [
      0,
      0, // top-left
      imageWidth,
      0, // top-right
      imageWidth,
      imageHeight, // bottom-right
      0,
      imageHeight, // bottom-left
    ];

    // Целевые координаты (четырехугольник)
    const dst = [
      corners.topLeft.x,
      corners.topLeft.y,
      corners.topRight.x,
      corners.topRight.y,
      corners.bottomRight.x,
      corners.bottomRight.y,
      corners.bottomLeft.x,
      corners.bottomLeft.y,
    ];

    // Вычисляем матрицу перспективной трансформации
    const matrix = getPerspectiveTransform(src, dst);
    return matrix;
  };

  // Функция для получения матрицы перспективной трансформации
  const getPerspectiveTransform = (src: number[], dst: number[]): number[] => {
    const A = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
      const sx = src[i * 2];
      const sy = src[i * 2 + 1];
      const dx = dst[i * 2];
      const dy = dst[i * 2 + 1];

      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
      b.push(dx, dy);
    }

    // Решение системы линейных уравнений
    const h = solve(A, b);
    h.push(1);

    return h;
  };

  // Простое решение системы линейных уравнений методом Гаусса
  const solve = (A: number[][], b: number[]): number[] => {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);

    // Прямой ход
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    // Обратный ход
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }

    return x;
  };

  useEffect(() => {
    if (!pixiContainerRef.current || !imageSrc) return;

    let isMounted = true;

    // Initialize Pixi application
    const app = new PIXI.Application();
    pixiAppRef.current = app;

    const initializePixi = async () => {
      try {
        await app.init({
          width,
          height,
          backgroundColor: 0xf3f4f6,
          antialias: true,
        });

        // Check if component is still mounted
        if (!isMounted || !pixiContainerRef.current) return;

        pixiContainerRef.current.appendChild(app.canvas);
        isInitializedRef.current = true;

        // Load texture
        const texture = await PIXI.Assets.load(imageSrc);

        // Check again if still mounted
        if (!isMounted) return;

        // Create container
        const container = new PIXI.Container();
        containerRef.current = container;

        // Create sprite
        const sprite = new PIXI.Sprite(texture);
        container.addChild(sprite);

        app.stage.addChild(container);
        updatePerspectiveTransform();
      } catch (error) {
        console.error("Failed to initialize Pixi.js:", error);
      }
    };

    initializePixi();

    return () => {
      isMounted = false;
      if (pixiAppRef.current && isInitializedRef.current) {
        try {
          pixiAppRef.current.destroy(true);
        } catch (error) {
          console.error("Error destroying Pixi app:", error);
        }
      }
      pixiAppRef.current = null;
      containerRef.current = null;
      isInitializedRef.current = false;
    };
  }, [imageSrc, width, height]);

  const updatePerspectiveTransform = () => {
    if (
      !containerRef.current ||
      !pixiAppRef.current ||
      !isInitializedRef.current
    )
      return;

    try {
      const container = containerRef.current;
      const sprite = container.children[0] as PIXI.Sprite;
      const {
        topLeft,
        topRight,
        bottomLeft,
        bottomRight,
        brightness,
        contrast,
        saturation,
        rotation,
        scale,
      } = geometry;

      // Scale coordinates to fit preview canvas
      const scaleX = width / 400;
      const scaleY = height / 300;

      // Scaled corner positions
      const corners = {
        topLeft: { x: topLeft.x * scaleX, y: topLeft.y * scaleY },
        topRight: { x: topRight.x * scaleX, y: topRight.y * scaleY },
        bottomLeft: { x: bottomLeft.x * scaleX, y: bottomLeft.y * scaleY },
        bottomRight: { x: bottomRight.x * scaleX, y: bottomRight.y * scaleY },
      };

      // Set sprite size
      const spriteWidth = 200;
      const spriteHeight = 150;
      sprite.width = spriteWidth;
      sprite.height = spriteHeight;

      // Calculate perspective transform matrix
      const matrix = calculatePerspectiveTransform(
        corners,
        spriteWidth,
        spriteHeight
      );

      // Apply the transform matrix to the sprite
      // PIXI uses a 2D transform matrix, so we need to approximate the perspective effect
      const transform = new PIXI.Matrix();

      // Extract the 2D affine part from the perspective matrix
      transform.a = matrix[0]; // scale x
      transform.b = matrix[3]; // skew y
      transform.c = matrix[1]; // skew x
      transform.d = matrix[4]; // scale y
      transform.tx = matrix[2]; // translate x
      transform.ty = matrix[5]; // translate y

      // Apply transform
      sprite.setFromMatrix(transform);

      // Apply additional transformations
      container.scale.set(scale / 100);
      container.angle = rotation * (Math.PI / 180);

      // Apply color filters
      const colorMatrix = new PIXI.ColorMatrixFilter();
      colorMatrix.brightness(brightness / 100, false);
      colorMatrix.contrast(contrast / 100, false);
      colorMatrix.saturate(saturation / 100, false);

      container.filters = [colorMatrix];
    } catch (error) {
      console.error("Error updating perspective:", error);
    }
  };

  useEffect(() => {
    updatePerspectiveTransform();
  }, [geometry]);

  return <div ref={pixiContainerRef} className="rounded-lg overflow-hidden" />;
}

export default function GeometryEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  const [availableImages, setAvailableImages] = useState<string[]>([]);

  const [geometry, setGeometry] = useState<GeometrySettings>({
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

  useEffect(() => {
    const fetchImages = async () => {
      const response = await fetch("/api/files");
      const data = await response.json();
      setAvailableImages(data.files.map((file: { name: string }) => file.name));
    };
    fetchImages();
  }, []);

  useEffect(() => {
    drawCanvas();
  }, [geometry, selectedImage, showGrid]);

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

    setGeometry((prev) => ({
      ...prev,
      [isDragging]: { x, y },
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const resetGeometry = () => {
    setGeometry({
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
    fetch("http://localhost:8000/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geometry),
    }).catch(console.error);
  }, [geometry]);

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
                    onClick={() => setSelectedImage(image)}
                    className={`w-full p-3 text-left rounded-lg border transition-colors ${
                      selectedImage === image
                        ? "bg-blue-50 border-blue-300 text-blue-900"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {image.replace("/", "")}
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
                  .slice(0, 4)
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
                            setGeometry((prev) => ({
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
                            setGeometry((prev) => ({
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
                      setGeometry((prev) => ({
                        ...prev,
                        brightness: Number(e.target.value),
                      }))
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
                      setGeometry((prev) => ({
                        ...prev,
                        contrast: Number(e.target.value),
                      }))
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
                      setGeometry((prev) => ({
                        ...prev,
                        saturation: Number(e.target.value),
                      }))
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
                      setGeometry((prev) => ({
                        ...prev,
                        rotation: Number(e.target.value),
                      }))
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
                      setGeometry((prev) => ({
                        ...prev,
                        scale: Number(e.target.value),
                      }))
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
            {showPreview && !selectedImage && (
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
