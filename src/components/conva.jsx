import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Stage, Layer, Rect, Circle, Line, RegularPolygon, Image as KonvaImage, Transformer } from "react-konva";
import CustomButton from "./CustomButton";
import ImageCropper from "./image-cropper";
const KonvaApp = () => {
  const [shapes, setShapes] = useState([]);
  const [tool, setTool] = useState("rectangle");
  const [brushType, setBrushType] = useState("normal");
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineStart, setLineStart] = useState({ x: 0, y: 0 });
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const colorInputRef = useRef(null);
  const [opacity, setOpacity] = useState(1);
  const [selectedShapeIndex, setSelectedShapeIndex] = useState(null);
  const [stageWidth, setStageWidth] = useState(800);
  const [stageHeight, setStageHeight] = useState(500);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const transformerRef = useRef(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStartPoint, setCropStartPoint] = useState({ x: 0, y: 0 });
  const [cropEndPoint, setCropEndPoint] = useState({ x: 0, y: 0 });
  const [cropRectVisible, setCropRectVisible] = useState(false);
  const cropRectRef = useRef(null);

  // For spray brush
  const sprayTimerRef = useRef(null);

  // For undo/redo functionality
  const [history, setHistory] = useState([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  // Store the current action to prevent creating too many history states
  const isPerformingAction = useRef(false);

  // Add to history after each shape is completed (not during drawing)
  const addToHistory = (newShapes) => {
    // Don't add to history if we're just updating during drawing
    if (isPerformingAction.current) return;

    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push([...newShapes]);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  // Responsive stage size calculation
  const checkSize = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      // Set a minimum width to prevent canvas from becoming too small
      const newWidth = Math.max(containerWidth - 20, 300);
      // Keep aspect ratio of original canvas (800x500 = 1.6)
      const newHeight = Math.floor(newWidth / 1.6);

      setStageWidth(newWidth);
      setStageHeight(newHeight);
    }
  };

   // New state for crop modal
   const [showCropModal, setShowCropModal] = useState(false);
   const [cropImageData, setCropImageData] = useState(null);
   const [cropImageIndex, setCropImageIndex] = useState(null);
 
   // Refs
 
   // Function to open crop modal with selected image
   const openCropModal = (imageIndex) => {
     const selectedImage = shapes[imageIndex];
     if (selectedImage && selectedImage.type === "image") {
       // Create a data URL from the image
       const img = selectedImage.image;
       
       // Create a canvas to get the image data
       const canvas = document.createElement('canvas');
       canvas.width = img.width;
       canvas.height = img.height;
       const ctx = canvas.getContext('2d');
       ctx.drawImage(img, 0, 0);
       
       // Get data URL and pass to crop modal
       const dataURL = canvas.toDataURL();
       
       setCropImageData(dataURL);
       setCropImageIndex(imageIndex);
       setShowCropModal(true);
     }
   };
 
   // Function to handle the cropped image from ImageCropper
   const handleCroppedImage = (croppedImageUrl) => {
     if (!croppedImageUrl || cropImageIndex === null) {
       setShowCropModal(false);
       return;
     }
 
     // Load the cropped image
     const img = new Image();
     img.onload = () => {
       // Create a new shape with the cropped image
       const updatedShapes = [...shapes];
       const selectedShape = updatedShapes[cropImageIndex];
       
       // Update the existing image with the cropped version
       updatedShapes[cropImageIndex] = {
         ...selectedShape,
         image: img,
         originalWidth: img.width,
         originalHeight: img.height,
         // Reset transformations if needed
         scaleX: 1,
         scaleY: 1,
         rotation: 0
       };
       
       // Add to history
       const newHistory = history.slice(0, historyStep + 1);
       newHistory.push(updatedShapes);
       
       // Update state
       setShapes(updatedShapes);
       setHistory(newHistory);
       setHistoryStep(newHistory.length - 1);
       setShowCropModal(false);
     };
     
     img.src = croppedImageUrl;
   };
 
   // Function to cancel cropping
   const handleCancelCrop = () => {
     setShowCropModal(false);
     setCropImageData(null);
     setCropImageIndex(null);
   };
 
   // Modify your existing handleImageSelect to integrate with new crop functionality
   const handleImageSelect = (index) => {
     if (tool === "move") {
       // Select the image for moving/transforming
       handleShapeSelect(index);
     } else if (tool === "cropImage") {
       // Open the crop modal with the selected image
       openCropModal(index);
     }
   };
 
   // Add this to replace your current crop related functions
   const startCropping = () => {
     if (selectedShapeIndex !== null && shapes[selectedShapeIndex].type === "image") {
       openCropModal(selectedShapeIndex);
     }
   };

  useEffect(() => {
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleUndo = () => {
    if (historyStep > 0) {
      isPerformingAction.current = true;
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      setShapes([...history[newStep]]);
      setTimeout(() => {
        isPerformingAction.current = false;
      }, 10);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      isPerformingAction.current = true;
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      setShapes([...history[newStep]]);
      setTimeout(() => {
        isPerformingAction.current = false;
      }, 10);
    }
  };

  // Image handling functions
  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;

        img.onload = () => {
          // Calculate the aspect ratio
          const imgWidth = img.width;
          const imgHeight = img.height;

          // Scale down the image if it's too large
          let newWidth = imgWidth;
          let newHeight = imgHeight;

          const maxDimension = Math.min(stageWidth, stageHeight) * 0.8;

          if (imgWidth > maxDimension || imgHeight > maxDimension) {
            if (imgWidth > imgHeight) {
              newWidth = maxDimension;
              newHeight = (imgHeight / imgWidth) * maxDimension;
            } else {
              newHeight = maxDimension;
              newWidth = (imgWidth / imgHeight) * maxDimension;
            }
          }

          // Position the image in the center of the stage
          const centerX = stageWidth / 2 - newWidth / 2;
          const centerY = stageHeight / 2 - newHeight / 2;

          const newImage = {
            type: "image",
            x: centerX,
            y: centerY,
            width: newWidth,
            height: newHeight,
            image: img,
            opacity: opacity,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            originalWidth: newWidth,
            originalHeight: newHeight,
            originalSrc: event.target.result,
          };

          const newShapes = [...shapes, newImage];
          setShapes(newShapes);
          addToHistory(newShapes);

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        };
      };

      reader.readAsDataURL(e.target.files[0]);
    }
  };

 

  const handleTransformEnd = (e) => {
    if (selectedShapeIndex === null) return;

    const shape = shapes[selectedShapeIndex];
    if (shape.type !== "image") return;

    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();

    // Update the shape with the new transformation
    setShapes(prevShapes => {
      const newShapes = [...prevShapes];
      newShapes[selectedShapeIndex] = {
        ...shape,
        rotation,
        scaleX,
        scaleY,
        // Store the width and height as calculated by the transformer
        width: shape.originalWidth * scaleX,
        height: shape.originalHeight * scaleY,
      };
      return newShapes;
    });

    // Add to history after transform
    addToHistory([...shapes]);
  };

  const finishCropping = () => {
    if (!isCropping || selectedShapeIndex === null) return;

    const shape = shapes[selectedShapeIndex];
    if (shape.type !== "image" || !cropRectVisible) {
      setIsCropping(false);
      return;
    }

    // Create a temporary canvas to crop the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Get the crop coordinates relative to the image
    const imageNode = layerRef.current.findOne(`#shape-${selectedShapeIndex}`);
    const imageRect = imageNode.getClientRect();

    // Convert stage coordinates to image coordinates
    const topLeft = stageRef.current.getAbsoluteTransform().invert().point({
      x: Math.min(cropStartPoint.x, cropEndPoint.x),
      y: Math.min(cropStartPoint.y, cropEndPoint.y),
    });

    const bottomRight = stageRef.current.getAbsoluteTransform().invert().point({
      x: Math.max(cropStartPoint.x, cropEndPoint.x),
      y: Math.max(cropStartPoint.y, cropEndPoint.y),
    });

    // Calculate crop dimensions in image coordinates
    const cropX = (topLeft.x - shape.x) / shape.scaleX;
    const cropY = (topLeft.y - shape.y) / shape.scaleY;
    const cropWidth = (bottomRight.x - topLeft.x) / shape.scaleX;
    const cropHeight = (bottomRight.y - topLeft.y) / shape.scaleY;

    // Ensure crop dimensions are valid
    if (cropWidth <= 0 || cropHeight <= 0) {
      setIsCropping(false);
      setCropRectVisible(false);
      return;
    }

    // Set canvas dimensions to the cropped size
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw the cropped portion of the image
    ctx.drawImage(
      shape.image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    // Create a new image from the canvas
    const croppedDataURL = canvas.toDataURL();
    const croppedImg = new window.Image();

    croppedImg.onload = () => {
      // Replace the original image with the cropped one
      setShapes(prevShapes => {
        const newShapes = [...prevShapes];
        newShapes[selectedShapeIndex] = {
          ...shape,
          image: croppedImg,
          originalWidth: cropWidth,
          originalHeight: cropHeight,
          width: cropWidth,
          height: cropHeight,
          x: topLeft.x,
          y: topLeft.y,
          scaleX: 1,
          scaleY: 1,
          originalSrc: croppedDataURL,
        };
        return newShapes;
      });

      // Add to history after cropping
      addToHistory([...shapes]);

      // Reset cropping state
      setIsCropping(false);
      setCropRectVisible(false);
    };

    croppedImg.src = croppedDataURL;
  };

  const cancelCropping = () => {
    setIsCropping(false);
    setCropRectVisible(false);
  };

  const handleMouseDown = (e) => {

    if (tool === "move") return;

    setIsDrawing(true);
    const { x, y } = e.target.getStage().getPointerPosition();

    if (tool === "rectangle") {
      setShapes([...shapes, {
        type: "rect",
        x, y,
        width: 0,
        height: 0,
        fill: "transparent",
        stroke: color,
        strokeWidth: brushSize,
        opacity
      }]);
    } else if (tool === "square") {
      setShapes([...shapes, {
        type: "square",
        x, y,
        size: 0,
        fill: "transparent",
        stroke: color,
        strokeWidth: brushSize,
        opacity
      }]);
    } else if (tool === "circle") {
      setShapes([...shapes, {
        type: "circle",
        x, y,
        radius: 0,
        fill: "transparent",
        stroke: color,
        strokeWidth: brushSize,
        opacity
      }]);
    } else if (tool === "triangle") {
      setShapes([...shapes, {
        type: "triangle",
        x, y,
        radius: 0,
        sides: 3,
        fill: "transparent",
        stroke: color,
        strokeWidth: brushSize,
        opacity,
        rotation: 0
      }]);
    } else if (tool === "line") {
      setShapes([...shapes, {
        type: "line",
        points: [x, y],
        stroke: color,
        strokeWidth: brushSize,
        brushType,
        opacity,
        tension: brushType === "watercolor" ? 0.5 : 0,
        lineCap: "round",
        lineJoin: "round",
        offsetX: 0, // Add offset properties for dragging
        offsetY: 0
      }]);

      if (brushType === "spray") {
        handleSpray(x, y);
        sprayTimerRef.current = setInterval(() => {
          if (isDrawing) {
            const stage = stageRef.current;
            if (stage) {
              const position = stage.getPointerPosition();
              if (position) {
                handleSpray(position.x, position.y);
              }
            }
          }
        }, 50);
      }
    } else if (tool === "straightLine") {
      setLineStart({ x, y });
      setShapes([...shapes, {
        type: "straightLine",
        points: [x, y, x, y],
        stroke: color,
        strokeWidth: brushSize,
        opacity,
        offsetX: 0, // Add offset properties for dragging
        offsetY: 0
      }]);
    } else if (tool === "eraser") {
      setShapes([...shapes, {
        type: "line",
        points: [x, y],
        stroke: "white",
        strokeWidth: brushSize * 5,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        offsetX: 0, // Add offset properties for dragging
        offsetY: 0
      }]);
    }
  };

  const handleSpray = (x, y) => {
    const radius = 20; // Fixed 20px radius instead of brushSize * 5
    const density = brushSize * 2;

    for (let i = 0; i < density; i++) {
      const randomRadius = Math.random() * radius;
      const randomAngle = Math.random() * 2 * Math.PI;
      const randomX = x + randomRadius * Math.cos(randomAngle);
      const randomY = y + randomRadius * Math.sin(randomAngle);

      setShapes(prev => [...prev, {
        type: "circle",
        x: randomX,
        y: randomY,
        radius: Math.random() * brushSize / 2 + 0.5,
        fill: color,
        opacity: Math.random() * 0.7 * opacity
      }]);
    }
  };

  const handleMouseMove = (e) => {
    // Handle crop rectangle if in crop mode
    if (isCropping && cropRectVisible) {
      const { x, y } = e.target.getStage().getPointerPosition();
      setCropEndPoint({ x, y });
      return;
    }

    if (!isDrawing) return;

    const { x, y } = e.target.getStage().getPointerPosition();

    setShapes((prevShapes) => {
      const newShapes = [...prevShapes];
      const shape = newShapes[newShapes.length - 1];

      if (shape.type === "rect") {
        shape.width = x - shape.x;
        shape.height = y - shape.y;
      } else if (shape.type === "square") {
        // For square, width and height are the same
        const size = Math.max(Math.abs(x - shape.x), Math.abs(y - shape.y));
        shape.size = size;
      } else if (shape.type === "circle") {
        if (brushType !== "spray" || tool !== "line") {
          shape.radius = Math.sqrt((x - shape.x) ** 2 + (y - shape.y) ** 2);
        }
      } else if (shape.type === "triangle") {
        shape.radius = Math.sqrt((x - shape.x) ** 2 + (y - shape.y) ** 2);
      } else if (shape.type === "line" || shape.type === "eraser") {
        if (brushType !== "spray" || tool === "eraser") {
          shape.points = [...shape.points, x, y];
        }
      } else if (shape.type === "straightLine") {
        // For straight line, we only update the end point
        shape.points = [shape.points[0], shape.points[1], x, y];
      }

      return newShapes;
    });

    if (brushType === "spray" && tool === "line") {
      handleSpray(x, y);
    }
  };

  const handleMouseUp = () => {
    // Handle crop completion
    if (isCropping && cropRectVisible) {
      finishCropping();
      return;
    }

    if (isDrawing) {
      // Add to history when the drawing action is completed
      addToHistory(shapes);
    }

    setIsDrawing(false);

    if (sprayTimerRef.current) {
      clearInterval(sprayTimerRef.current);
      sprayTimerRef.current = null;
    }
  };

  const handleTouchStart = (e) => {
    // Prevent scrolling on touch devices when interacting with canvas
    e.evt.preventDefault();
    handleMouseDown(e);
  };

  const handleTouchMove = (e) => {
    // Prevent scrolling on touch devices when interacting with canvas
    e.evt.preventDefault();
    handleMouseMove(e);
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  const handleShapeSelect = (index) => {
    if (tool === "move" || tool === "cropImage") {
      setSelectedShapeIndex(index);

      if (transformerRef.current) {
        const selectedNode = layerRef.current.findOne(`#shape-${index}`);
        if (selectedNode) {
          transformerRef.current.nodes([selectedNode]);
          transformerRef.current.getLayer().batchDraw();
        }
      }
    }
  };

  // New function to calculate bounding box for line points
  const getLineBoundingBox = (points) => {
    if (!points || points.length < 2) return { x: 0, y: 0, width: 0, height: 0 };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // New function to shift all points in a line by dx, dy
  const shiftLinePoints = (points, dx, dy) => {
    const newPoints = [];
    for (let i = 0; i < points.length; i += 2) {
      newPoints.push(points[i] + dx);
      newPoints.push(points[i + 1] + dy);
    }
    return newPoints;
  };

  const handleDragStart = (e, index) => {
    if (tool !== "move") return;

    // For regular shapes, Konva handles it automatically
    // For line-based shapes we need to store additional info
    const shape = shapes[index];

    if (shape.type === "line" || shape.type === "straightLine" || shape.type === "eraser") {
      // Store the original points
      e.target.setAttrs({
        originalPoints: [...shape.points]
      });
    }
  };

  const handleDragEnd = (e, index) => {
    if (tool !== "move") return;

    const shape = shapes[index];

    setShapes(prevShapes => {
      const newShapes = [...prevShapes];

      if (shape.type === "line" || shape.type === "straightLine" || shape.type === "eraser") {
        const originalPoints = e.target.attrs.originalPoints;
        const dx = e.target.x();
        const dy = e.target.y();

        // Create a new updated shape
        const updatedShape = { ...shape };
        updatedShape.points = shiftLinePoints(originalPoints, dx, dy);
        updatedShape.offsetX = 0; // Reset offsets after drag
        updatedShape.offsetY = 0;

        // Reset the Line position for next drag
        e.target.position({ x: 0, y: 0 });

        newShapes[index] = updatedShape;
      } else {
        // For regular shapes, just update their position
        const { x, y } = e.target.position();
        newShapes[index] = { ...shape, x, y };
      }

      return newShapes;
    });

    // Add to history after drag is completed
    addToHistory(shapes);
  };

  const handleSave = () => {
    localStorage.setItem("savedShapes", JSON.stringify(shapes));
    // Show save confirmation
    alert("Drawing saved successfully!");
  };

  const handleLoad = () => {
    const savedShapes = localStorage.getItem("savedShapes");
    if (savedShapes) {
      const loadedShapes = JSON.parse(savedShapes);
      // Process loaded shapes - need to reconstruct Image objects
      const processedShapes = loadedShapes.map(shape => {
        if (shape.type === "image" && shape.originalSrc) {
          // Create a new Image object for each image
          const img = new window.Image();
          img.src = shape.originalSrc;
          return { ...shape, image: img };
        }
        return shape;
      });

      setShapes(processedShapes);
      addToHistory(processedShapes);
      alert("Drawing loaded successfully!");
    } else {
      alert("No saved drawing found!");
    }
  };

  const handleDownloadJSON = () => {
    // Before saving, we need to convert image data to a serializable format
    const serializableShapes = shapes.map(shape => {
      if (shape.type === "image") {
        return {
          ...shape,
          image: null, // Remove the Image object as it's not serializable
          // The originalSrc property will be used to reconstruct the image when loading
        };
      }
      return shape;
    });

    const json = JSON.stringify(serializableShapes, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawing.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadImage = () => {
    if (stageRef.current) {
      // Hide transformer during export
      const transformer = transformerRef.current;
      if (transformer) {
        transformer.visible(false);
      }

      // Also hide crop rect if visible
      if (cropRectRef.current) {
        cropRectRef.current.visible(false);
      }

      // Redraw the layer
      layerRef.current.batchDraw();

      // Export
      const uri = stageRef.current.toDataURL();

      // Restore visibility
      if (transformer) {
        transformer.visible(true);
      }
      if (cropRectRef.current && cropRectVisible) {
        cropRectRef.current.visible(true);
      }
      layerRef.current.batchDraw();

      // Download
      const a = document.createElement("a");
      a.href = uri;
      a.download = "drawing.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the canvas?")) {
      setShapes([]);
      addToHistory([]);
      setSelectedShapeIndex(null);
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  };

  const handleColorChange = (e) => {
    setColor(e.target.value);
  };

  const handleBrushSizeChange = (e) => {
    setBrushSize(parseInt(e.target.value));
  };

  const handleOpacityChange = (e) => {
    setOpacity(parseFloat(e.target.value));
  };

  // Delete the selected shape
  const handleDeleteSelected = () => {
    if (selectedShapeIndex !== null) {
      const newShapes = shapes.filter((_, i) => i !== selectedShapeIndex);
      setShapes(newShapes);
      addToHistory(newShapes);
      setSelectedShapeIndex(null);

      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  };

  const handleMoveClick = useCallback(() => {
    setTool("move");
  }, []);

  // Reset image rotation and scaling
  const handleResetImageTransform = () => {
    if (selectedShapeIndex !== null) {
      const shape = shapes[selectedShapeIndex];
      if (shape.type === "image") {
        setShapes(prevShapes => {
          const newShapes = [...prevShapes];
          newShapes[selectedShapeIndex] = {
            ...shape,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            width: shape.originalWidth,
            height: shape.originalHeight
          };
          return newShapes;
        });

        addToHistory([...shapes]);
      }
    }
  };

  // Rotate the selected image 90 degrees
  const handleRotateImage = () => {
    if (selectedShapeIndex !== null) {
      const shape = shapes[selectedShapeIndex];
      if (shape.type === "image") {
        setShapes(prevShapes => {
          const newShapes = [...prevShapes];
          newShapes[selectedShapeIndex] = {
            ...shape,
            rotation: (shape.rotation || 0) + 90
          };
          return newShapes;
        });

        addToHistory([...shapes]);
      }
    }
  };

  // Initialize history with empty array
  useEffect(() => {
    setHistory([[]]);
    setHistoryStep(0);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sprayTimerRef.current) {
        clearInterval(sprayTimerRef.current);
      }
    };
  }, []);

  // Update transformer when selected shape changes
  useEffect(() => {
    if (transformerRef.current && layerRef.current) {
      if (selectedShapeIndex !== null) {
        const selectedNode = layerRef.current.findOne(`#shape-${selectedShapeIndex}`);
        if (selectedNode) {
          transformerRef.current.nodes([selectedNode]);
          transformerRef.current.getLayer().batchDraw();
        }
      } else {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedShapeIndex]);

  const isActive = useMemo(() => tool === "move", [tool]);
const buttonClassName = useMemo(() => "m-1 text-sm md:text-base", []);

  // Add keyboard shortcuts for undo/redo and delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z for Undo (Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z or Ctrl+Y for Redo (Cmd+Shift+Z or Cmd+Y on Mac)
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      // Delete key to delete selected shape
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIndex !== null) {
        e.preventDefault();
        handleDeleteSelected();
      }
      // Escape key to cancel cropping
      if (e.key === 'Escape' && isCropping) {
        e.preventDefault();
        cancelCropping();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [historyStep, history, selectedShapeIndex, isCropping]);

  return (
    <div className="flex flex-col items-center p-2 md:p-4 w-full max-w-full">
      <h1 className="text-xl md:text-2xl font-bold mb-2 md:mb-4">Advanced Drawing App</h1>

      {/* Tools section with tabs for small screens */}
      <div className="mb-2 md:mb-4 flex flex-col w-full">
        <div className="flex flex-wrap justify-center mb-2 overflow-x-auto">
          <CustomButton
            onClick={() => document.getElementById('shapes-section').scrollIntoView({ behavior: 'smooth' })}
            className="m-1 text-sm md:text-base"
          >
            Shapes
          </CustomButton>
          <CustomButton
            onClick={() => document.getElementById('brushes-section').scrollIntoView({ behavior: 'smooth' })}
            // Continue from where the code was cut off

            className="m-1 text-sm md:text-base"
          >
            Brushes
          </CustomButton>
          <CustomButton
            onClick={() => document.getElementById('colors-section').scrollIntoView({ behavior: 'smooth' })}
            className="m-1 text-sm md:text-base"
          >
            Colors
          </CustomButton>
          <CustomButton
            onClick={() => document.getElementById('actions-section').scrollIntoView({ behavior: 'smooth' })}
            className="m-1 text-sm md:text-base"
          >
            Actions
          </CustomButton>
          <CustomButton
            onClick={() => document.getElementById('images-section').scrollIntoView({ behavior: 'smooth' })}
            className="m-1 text-sm md:text-base"
          >
            Images
          </CustomButton>
        </div>

        {/* Shapes Section */}
        <div id="shapes-section" className="mb-4 p-2 border rounded">
          <h2 className="font-semibold mb-2">Shapes</h2>
          <div className="flex flex-wrap justify-center">
            <CustomButton
              onClick={() => { setTool("rectangle"); setSelectedShapeIndex(null); }}
              active={tool === "rectangle"}
              className="m-1 text-sm md:text-base"
            >
              Rectangle
            </CustomButton>
            <CustomButton
              onClick={() => { setTool("square"); setSelectedShapeIndex(null); }}
              active={tool === "square"}
              className="m-1 text-sm md:text-base"
            >
              Square
            </CustomButton>
            <CustomButton
              onClick={() => { setTool("circle"); setSelectedShapeIndex(null); }}
              active={tool === "circle"}
              className="m-1 text-sm md:text-base"
            >
              Circle
            </CustomButton>
            <CustomButton
              onClick={() => { setTool("triangle"); setSelectedShapeIndex(null); }}
              active={tool === "triangle"}
              className="m-1 text-sm md:text-base"
            >
              Triangle
            </CustomButton>
            <CustomButton
              onClick={() => { setTool("line"); setBrushType("normal"); setSelectedShapeIndex(null); }}
              active={tool === "line" && brushType === "normal"}
              className="m-1 text-sm md:text-base"
            >
              Line
            </CustomButton>
            <CustomButton
              onClick={() => { setTool("straightLine"); setSelectedShapeIndex(null); }}
              active={tool === "straightLine"}
              className="m-1 text-sm md:text-base"
            >
              Straight Line
            </CustomButton>
          </div>
        </div>

        {/* Brushes Section */}
        <div id="brushes-section" className="mb-4 p-2 border rounded">
          <h2 className="font-semibold mb-2">Brushes & Tools</h2>
          <div className="flex flex-wrap justify-center">
            <CustomButton
              onClick={() => { setTool("line"); setBrushType("normal"); setSelectedShapeIndex(null); }}
              active={tool === "line" && brushType === "normal"}
              className="m-1 text-sm md:text-base"
            >
              Normal Brush
            </CustomButton>
            <CustomButton
              onClick={() => { setTool("line"); setBrushType("watercolor"); setSelectedShapeIndex(null); }}
              active={tool === "line" && brushType === "watercolor"}
              className="m-1 text-sm md:text-base"
            >
              Watercolor
            </CustomButton>
            <CustomButton
              onClick={() => { setTool("line"); setBrushType("spray"); setSelectedShapeIndex(null); }}
              active={tool === "line" && brushType === "spray"}
              className="m-1 text-sm md:text-base"
            >
              Spray
            </CustomButton>
            <CustomButton
              onClick={() => { setTool("eraser"); setSelectedShapeIndex(null); }}
              active={tool === "eraser"}
              className="m-1 text-sm md:text-base"
            >
              Eraser
            </CustomButton>
            <CustomButton
              onClick={handleMoveClick}
              active={isActive}
              className={buttonClassName}
            >
              Move/Select
            </CustomButton>
          </div>

          {/* Brush Size Slider */}
          <div className="mt-3">
            <label className="block mb-1 text-sm font-medium">
              Brush Size: {brushSize}
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={handleBrushSizeChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Opacity Slider */}
          <div className="mt-3">
            <label className="block mb-1 text-sm font-medium">
              Opacity: {Math.round(opacity * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={handleOpacityChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Colors Section */}
        <div id="colors-section" className="mb-4 p-2 border rounded">
          <h2 className="font-semibold mb-2">Colors</h2>
          <div className="flex flex-col sm:flex-row items-center">
            <div className="flex flex-wrap justify-center mb-2 sm:mb-0 sm:mr-4">
              {/* Predefined colors */}
              {["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"].map((colorValue) => (
                <button
                  key={colorValue}
                  className={`w-8 h-8 rounded-full m-1 border ${color === colorValue ? 'border-2 border-gray-500' : 'border-gray-300'}`}
                  style={{ backgroundColor: colorValue }}
                  onClick={() => setColor(colorValue)}
                  aria-label={`Select color ${colorValue}`}
                />
              ))}
            </div>

            {/* Color picker */}
            <div className="flex items-center">
              <input
                ref={colorInputRef}
                type="color"
                value={color}
                onChange={handleColorChange}
                className="w-10 h-10 border-0 p-0 cursor-pointer"
              />
              <span className="ml-2">{color}</span>
            </div>
          </div>
        </div>

        {/* Images Section */}
        <div id="images-section" className="mb-4 p-2 border rounded">
          <h2 className="font-semibold mb-2">Image Tools</h2>
          <div className="flex flex-wrap justify-center mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <CustomButton
              onClick={() => fileInputRef.current.click()}
              className="m-1 text-sm md:text-base"
            >
              Upload Image
            </CustomButton>

            {/* Image manipulation tools - only visible when an image is selected */}
            {selectedShapeIndex !== null && shapes[selectedShapeIndex]?.type === "image" && (
              <>
                <CustomButton
                  onClick={handleRotateImage}
                  className="m-1 text-sm md:text-base"
                >
                  Rotate 90°
                </CustomButton>
                <CustomButton
                  onClick={handleResetImageTransform}
                  className="m-1 text-sm md:text-base"
                >
                  Reset Transform
                </CustomButton>
                <CustomButton
                  onClick={() => { setTool("cropImage"); }}
                  active={tool === "cropImage"}
                  className="m-1 text-sm md:text-base"
                >
                  Select for Crop
                </CustomButton>
                {tool === "cropImage" && selectedShapeIndex !== null && (
                  <CustomButton
                    onClick={startCropping}
                    className="m-1 text-sm md:text-base"
                  >
                    Start Cropping
                  </CustomButton>
                )}
                {isCropping && (
                  <>
                    <CustomButton
                      onClick={finishCropping}
                      className="m-1 text-sm md:text-base bg-green-500 hover:bg-green-600"
                    >
                      Apply Crop
                    </CustomButton>
                    <CustomButton
                      onClick={cancelCropping}
                      className="m-1 text-sm md:text-base bg-red-500 hover:bg-red-600"
                    >
                      Cancel Crop
                    </CustomButton>
                  </>
                )}
              </>
            )}
          </div>
          {/* Instructions for images */}
          <p className="text-sm text-gray-600">
            Use "Move/Select" tool to select and move images. After selecting an image, you can resize, rotate, or crop it.
          </p>
        </div>

        {/* Actions Section */}
        <div id="actions-section" className="p-2 border rounded">
          <h2 className="font-semibold mb-2">Actions</h2>
          <div className="flex flex-wrap justify-center">
            <CustomButton
              onClick={handleUndo}
              disabled={historyStep === 0}
              className="m-1 text-sm md:text-base"
            >
              Undo
            </CustomButton>
            <CustomButton
              onClick={handleRedo}
              disabled={historyStep === history.length - 1}
              className="m-1 text-sm md:text-base"
            >
              Redo
            </CustomButton>
            <CustomButton
              onClick={handleSave}
              className="m-1 text-sm md:text-base"
            >
              Save
            </CustomButton>
            <CustomButton
              onClick={handleLoad}
              className="m-1 text-sm md:text-base"
            >
              Load
            </CustomButton>
            <CustomButton
              onClick={handleDownloadImage}
              className="m-1 text-sm md:text-base"
            >
              Export Image
            </CustomButton>
            <CustomButton
              onClick={handleDownloadJSON}
              className="m-1 text-sm md:text-base"
            >
              Export JSON
            </CustomButton>
            <CustomButton
              onClick={handleClear}
              className="m-1 text-sm md:text-base bg-red-500 hover:bg-red-600"
            >
              Clear All
            </CustomButton>
            {selectedShapeIndex !== null && (
              <CustomButton
                onClick={handleDeleteSelected}
                className="m-1 text-sm md:text-base bg-red-500 hover:bg-red-600"
              >
                Delete Selected
              </CustomButton>
            )}
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="border border-gray-300 rounded-lg bg-white overflow-hidden w-full max-w-5xl"
      >
        <Stage
          width={stageWidth}
          height={stageHeight}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          ref={stageRef}
        >
          <Layer ref={layerRef}>
            {shapes.map((shape, index) => {
              if (shape.type === "rect") {
                return (
                  <Rect
                    key={index}
                    id={`shape-${index}`}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    opacity={shape.opacity}
                    draggable={tool === "move"}
                    onClick={() => handleShapeSelect(index)}
                    onTap={() => handleShapeSelect(index)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={(e) => handleDragEnd(e, index)}
                  />
                );
              } else if (shape.type === "square") {
                return (
                  <Rect
                    key={index}
                    id={`shape-${index}`}
                    x={shape.x}
                    y={shape.y}
                    width={shape.size}
                    height={shape.size}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    opacity={shape.opacity}
                    draggable={tool === "move"}
                    onClick={() => handleShapeSelect(index)}
                    onTap={() => handleShapeSelect(index)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={(e) => handleDragEnd(e, index)}
                  />
                );
              } else if (shape.type === "circle") {
                return (
                  <Circle
                    key={index}
                    id={`shape-${index}`}
                    x={shape.x}
                    y={shape.y}
                    radius={shape.radius}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    opacity={shape.opacity}
                    draggable={tool === "move"}
                    onClick={() => handleShapeSelect(index)}
                    onTap={() => handleShapeSelect(index)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={(e) => handleDragEnd(e, index)}
                  />
                );
              } else if (shape.type === "triangle") {
                return (
                  <RegularPolygon
                    key={index}
                    id={`shape-${index}`}
                    x={shape.x}
                    y={shape.y}
                    sides={shape.sides}
                    radius={shape.radius}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    opacity={shape.opacity}
                    rotation={shape.rotation}
                    draggable={tool === "move"}
                    onClick={() => handleShapeSelect(index)}
                    onTap={() => handleShapeSelect(index)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={(e) => handleDragEnd(e, index)}
                  />
                );
              } else if (shape.type === "line" || shape.type === "eraser") {
                // Get bounding box for line
                const bbox = getLineBoundingBox(shape.points);

                return (
                  <Line
                    key={index}
                    id={`shape-${index}`}
                    points={shape.points}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    tension={shape.tension || 0}
                    lineCap={shape.lineCap || "round"}
                    lineJoin={shape.lineJoin || "round"}
                    opacity={shape.opacity}
                    x={shape.offsetX || 0}
                    y={shape.offsetY || 0}
                    draggable={tool === "move"}
                    onClick={() => handleShapeSelect(index)}
                    onTap={() => handleShapeSelect(index)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={(e) => handleDragEnd(e, index)}
                  />
                );
              } else if (shape.type === "straightLine") {
                return (
                  <Line
                    key={index}
                    id={`shape-${index}`}
                    points={shape.points}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    opacity={shape.opacity}
                    x={shape.offsetX || 0}
                    y={shape.offsetY || 0}
                    draggable={tool === "move"}
                    onClick={() => handleShapeSelect(index)}
                    onTap={() => handleShapeSelect(index)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={(e) => handleDragEnd(e, index)}
                  />
                );
              } else if (shape.type === "image") {
                return (
                  <KonvaImage
                    key={index}
                    id={`shape-${index}`}
                    x={shape.x}
                    y={shape.y}
                    width={shape.originalWidth}
                    height={shape.originalHeight}
                    image={shape.image}
                    opacity={shape.opacity}
                    draggable={tool === "move" || tool === "cropImage"}
                    rotation={shape.rotation || 0}
                    scaleX={shape.scaleX || 1}
                    scaleY={shape.scaleY || 1}
                    onClick={() => handleImageSelect(index)}
                    onTap={() => handleImageSelect(index)}
                    onDragEnd={(e) => handleDragEnd(e, index)}
                    onTransformEnd={handleTransformEnd}
                  />
                );
              }

              return null;
            })}

            {/* Transformer for selected shapes */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Limit size to minimum dimensions
                if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox;
                }
                return newBox;
              }}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              rotateEnabled={true}
              keepRatio={false}
            />

            {/* Crop rectangle */}
            {isCropping && cropRectVisible && (
              <Rect
                ref={cropRectRef}
                x={Math.min(cropStartPoint.x, cropEndPoint.x)}
                y={Math.min(cropStartPoint.y, cropEndPoint.y)}
                width={Math.abs(cropEndPoint.x - cropStartPoint.x)}
                height={Math.abs(cropEndPoint.y - cropStartPoint.y)}
                stroke="black"
                strokeWidth={2}
                dash={[6, 3]}
                fill="rgba(0, 0, 0, 0.2)"
              />
            )}
          </Layer>
        </Stage>
      </div>

      {/* Status Bar */}
      <div className="mt-2 w-full max-w-5xl bg-gray-100 p-2 rounded text-sm">
        <p>
          {tool === "move" ? "Click on a shape to select it" :
            isCropping ? "Draw a rectangle to crop the selected image" :
              `Selected Tool: ${tool} ${tool === "line" ? `(${brushType})` : ""}`}
        </p>
        {selectedShapeIndex !== null && (
          <p>Selected shape: {shapes[selectedShapeIndex].type} (Index: {selectedShapeIndex})</p>
        )}
      </div>
      {showCropModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-6xl max-h-screen overflow-auto">
            <h2 className="text-xl font-bold mb-4">Crop Image</h2>
            
            {cropImageData && (
              <ImageCropper 
                initialImage={cropImageData} 
                onCrop={handleCroppedImage}
                onCancel={handleCancelCrop}
              />
            )}
          
          </div>
        </div>
      )}

    </div>
  );
};

export default KonvaApp;