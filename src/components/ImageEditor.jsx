import React, { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Undo, Redo, RotateCcw, ZoomIn, ZoomOut, Maximize } from "lucide-react";

const ImageEditor = () => {
  const [imgSrc, setImgSrc] = useState("");
  const [blurAreas, setBlurAreas] = useState([]);
  const [blurAmount, setBlurAmount] = useState(5);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);

  const onSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImgSrc(reader.result?.toString() || "");
        setBlurAreas([]);
        setHistory([]);
        setHistoryIndex(-1);
        setIsCanvasReady(false);
        setZoom(1);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const updateCanvasSize = () => {
    if (imgSrc && canvasRef.current && containerRef.current) {
      const img = new Image();
      img.onload = () => {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const imgAspectRatio = img.width / img.height;
        const containerAspectRatio = containerWidth / containerHeight;

        let newWidth, newHeight;
        if (imgAspectRatio > containerAspectRatio) {
          newWidth = containerWidth;
          newHeight = containerWidth / imgAspectRatio;
        } else {
          newHeight = containerHeight;
          newWidth = containerHeight * imgAspectRatio;
        }

        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const newScale = newWidth / img.width;
        setScale(newScale);

        canvas.style.width = `${newWidth * zoom}px`;
        canvas.style.height = `${newHeight * zoom}px`;
        setIsCanvasReady(true);
        redrawCanvas();
      };
      img.src = imgSrc;
    }
  };

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [imgSrc, zoom]);

  useEffect(() => {
    if (isCanvasReady) {
      redrawCanvas();
    }
  }, [isCanvasReady, blurAreas, historyIndex, blurAmount]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      blurAreas.forEach((area) => applyBlurToArea(ctx, area));
      if (isSelecting) {
        drawSelectionRect(ctx);
      }
    };
    img.src = imgSrc;
  };

  const applyBlurToArea = (ctx, area) => {
    ctx.save();
    ctx.filter = `blur(${area.blurAmount}px)`;
    ctx.drawImage(
      canvasRef.current,
      area.x,
      area.y,
      area.width,
      area.height,
      area.x,
      area.y,
      area.width,
      area.height
    );
    ctx.restore();
  };

  const drawSelectionRect = (ctx) => {
    const width = currentPos.x - startPos.x;
    const height = currentPos.y - startPos.y;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(startPos.x, startPos.y, width, height);
    ctx.setLineDash([]);
  };

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / (scale * zoom),
      y: (e.clientY - rect.top) / (scale * zoom),
    };
  };

  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    const pos = getMousePos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsSelecting(true);
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !canvasRef.current) return;
    const pos = getMousePos(e);
    setCurrentPos(pos);
    redrawCanvas();
  };

  const handleMouseUp = () => {
    if (!isSelecting || !canvasRef.current) return;
    setIsSelecting(false);
    const newArea = {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(currentPos.x - startPos.x),
      height: Math.abs(currentPos.y - startPos.y),
      blurAmount,
    };
    const newBlurAreas = [...blurAreas, newArea];
    setBlurAreas(newBlurAreas);
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, newBlurAreas]);
    setHistoryIndex(newHistory.length);
    redrawCanvas();
  };

  const handleBlurChange = (value) => {
    setBlurAmount(value[0]);
    const updatedAreas = blurAreas.map((area) => ({
      ...area,
      blurAmount: value[0],
    }));
    setBlurAreas(updatedAreas);
    redrawCanvas();
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setBlurAreas(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setBlurAreas(history[historyIndex + 1]);
    }
  };

  const reset = () => {
    setBlurAreas([]);
    setHistory([]);
    setHistoryIndex(-1);
    redrawCanvas();
  };

  const handleDownload = (format) => {
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `edited-image.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, `image/${format}`);
    }
  };

  const zoomIn = () => {
    setZoom((prevZoom) => Math.min(prevZoom + 0.1, 3));
  };

  const zoomOut = () => {
    setZoom((prevZoom) => Math.max(prevZoom - 0.1, 0.1));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 flex items-center justify-center p-4">
        <div className="container mx-auto max-w-4xl bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-100">
              Selective Blur Image Editor
            </h1>
            <div className="flex space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100"
                  >
                    <Undo className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100"
                  >
                    <Redo className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={reset}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="mb-6">
            <Input
              type="file"
              accept="image/*"
              onChange={onSelectFile}
              className="w-full bg-gray-700 text-gray-100 border-gray-600"
            />
          </div>
          {imgSrc && (
            <div>
              <div className="mb-4 flex justify-center space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={zoomIn}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-100 transition-all duration-200 ease-in-out transform hover:scale-110"
                    >
                      <ZoomIn className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom In</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={zoomOut}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-100 transition-all duration-200 ease-in-out transform hover:scale-110"
                    >
                      <ZoomOut className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom Out</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={resetZoom}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-100 transition-all duration-200 ease-in-out transform hover:scale-110"
                    >
                      <Maximize className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fit View</TooltipContent>
                </Tooltip>
              </div>
              <div
                ref={containerRef}
                className="mb-6 flex justify-center items-center overflow-auto bg-gray-700 rounded-lg"
                style={{ height: "60vh" }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="object-contain"
                  style={{ cursor: "crosshair" }}
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Blur Amount: {blurAmount}px
                </label>
                <Slider
                  value={[blurAmount]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={handleBlurChange}
                  className="w-full"
                />
              </div>
              <div className="flex justify-center space-x-4">
                <Button
                  onClick={() => handleDownload("png")}
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
                >
                  Download PNG
                </Button>
                <Button
                  onClick={() => handleDownload("jpeg")}
                  className="bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
                >
                  Download JPEG
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ImageEditor;
