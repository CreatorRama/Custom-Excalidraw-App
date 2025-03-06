import React, { useState, useRef, useCallback, useEffect } from 'react';

const ImageCropper = ({ initialImage, onCrop, onCancel }) => {
  const [image, setImage] = useState(null);
  const [cropBox, setCropBox] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [imageSize, setImageSize] = useState({
    width: 0,
    height: 0,
    originalWidth: 0,
    originalHeight: 0
  });

  // Load initial image when component mounts
  useEffect(() => {
    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageSize({
          width: img.width,
          height: img.height,
          originalWidth: img.width,
          originalHeight: img.height
        });
        setCropBox({
          x: 0,
          y: 0,
          width: 0,
          height: 0
        });
      };
      img.src = initialImage;
    }
  }, [initialImage]);

  // Get coordinates from touch or mouse event
  const getEventCoordinates = (e) => {
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Check if it's a touch event
    if (e.touches) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    
    // Mouse event
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Handle image upload for manual testing
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageSize({
          width: img.width,
          height: img.height,
          originalWidth: img.width,
          originalHeight: img.height
        });
        setCropBox({
          x: 0,
          y: 0,
          width: 0,
          height: 0
        });
      };
      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  };

  // Handle width and height change
  const handleWidthChange = (e) => {
    // Parse the input value, defaulting to 1 if empty or NaN
    const inputWidth = parseInt(e.target.value) || 1;
    
    // Constrain width between 1 and 2000
    const newWidth = Math.max(0, Math.min(inputWidth, 2000));
    
    const aspectRatio = imageSize.originalWidth / imageSize.originalHeight;
    const newHeight = Math.round(newWidth / aspectRatio);

    setImageSize(prev => ({
      ...prev,
      width: newWidth,
      height: newHeight
    }));
  };

  const handleHeightChange = (e) => {
    const newHeight = Math.max(0, Math.min(parseInt(e.target.value), 2000));
    const aspectRatio = imageSize.originalWidth / imageSize.originalHeight;
    const newWidth = Math.round(newHeight * aspectRatio);

    setImageSize(prev => ({
      ...prev,
      width: newWidth,
      height: newHeight
    }));
  };

  // Touch start handling
  const handleTouchStart = useCallback((e) => {
    if (!image) return;

    // Prevent default to stop scrolling
    e.preventDefault();

    const container = containerRef.current;
    const { x, y } = getEventCoordinates(e);
    
    // Prevent drawing outside image
    if (x < 0 || y < 0 || 
        x > container.offsetWidth || 
        y > container.offsetHeight) {
      return;
    }

    setIsDrawing(true);

    // Reset crop box and start new selection
    setCropBox({
      x,
      y,
      width: 0,
      height: 0
    });
  }, [image]);

  // Touch move handling
  const handleTouchMove = useCallback((e) => {
    if (!isDrawing || !image) return;

    // Prevent default to stop scrolling
    e.preventDefault();

    const container = containerRef.current;
    const { x: currentX, y: currentY } = getEventCoordinates(e);

    // Constrain to container bounds
    const constrainedX = Math.max(0, Math.min(currentX, container.offsetWidth));
    const constrainedY = Math.max(0, Math.min(currentY, container.offsetHeight));

    setCropBox(prev => {
      // Calculate new dimensions
      const newWidth = Math.abs(constrainedX - prev.x);
      const newHeight = Math.abs(constrainedY - prev.y);

      return {
        x: Math.min(prev.x, constrainedX),
        y: Math.min(prev.y, constrainedY),
        width: newWidth,
        height: newHeight
      };
    });
  }, [isDrawing, image]);

  // Touch end handling
  const handleTouchEnd = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Mouse down handling
  const handleMouseDown = useCallback((e) => {
    if (!image) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    // Prevent drawing outside image
    if (startX < 0 || startY < 0 || 
        startX > container.offsetWidth || 
        startY > container.offsetHeight) {
      return;
    }

    setIsDrawing(true);

    // Reset crop box and start new selection
    setCropBox({
      x: startX,
      y: startY,
      width: 0,
      height: 0
    });
  }, [image]);

  // Mouse move handling
  const handleMouseMove = useCallback((e) => {
    if (!isDrawing || !image) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Constrain to container bounds
    const constrainedX = Math.max(0, Math.min(currentX, container.offsetWidth));
    const constrainedY = Math.max(0, Math.min(currentY, container.offsetHeight));

    setCropBox(prev => {
      // Calculate new dimensions
      const newWidth = Math.abs(constrainedX - prev.x);
      const newHeight = Math.abs(constrainedY - prev.y);

      return {
        x: Math.min(prev.x, constrainedX),
        y: Math.min(prev.y, constrainedY),
        width: newWidth,
        height: newHeight
      };
    });
  }, [isDrawing, image]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleCrop = (e) => {
    // Prevent the click from triggering document click event
    e.stopPropagation();

    if (!image || cropBox.width === 0 || cropBox.height === 0) return;

    // Create canvas for cropping
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate scale factor
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;
    const scaleX = image.width / containerWidth;
    const scaleY = image.height / containerHeight;

    // Calculate crop coordinates and dimensions
    const cropX = cropBox.x * scaleX;
    const cropY = cropBox.y * scaleY;
    const cropWidth = cropBox.width * scaleX;
    const cropHeight = cropBox.height * scaleY;

    // Set canvas size to match cropped area
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw cropped image
    ctx.drawImage(
      image,
      cropX, cropY,           // Source X, Y
      cropWidth, cropHeight,   // Source width, height
      0, 0,                   // Destination X, Y
      cropWidth, cropHeight    // Destination width, height
    );

    // Instead of downloading, pass the data URL to parent component
    const dataUrl = canvas.toDataURL('image/png');
    onCrop(dataUrl);
  };

  // Add global event listeners
  useEffect(() => {
    if (isDrawing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDrawing, handleMouseMove, handleMouseUp]);

  return (
    <div className="p-4 max-w-full mx-auto">
      {/* Hide file input as we're receiving image from parent */}
      {!initialImage && (
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageUpload} 
          className="mb-4"
        />
      )}

      {image && (
        <div>
          {/* Resize Controls */}
          <div className="flex flex-wrap space-x-4 mb-4">
            <div className="flex items-center">
              <label className="mr-2 text-sm">Width:</label>
              <input 
                type="number" 
                value={imageSize.width}
                onChange={handleWidthChange}
                min="0"
                max="2000"
                className="w-20 border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center">
              <label className="mr-2 text-sm">Height:</label>
              <input 
                type="number" 
                value={imageSize.height}
                onChange={handleHeightChange}
                min="0"
                max="2000"
                className="w-20 border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center text-sm text-gray-600">
              Original Size: {imageSize.originalWidth} x {imageSize.originalHeight}
            </div>
          </div>

          <div 
            ref={containerRef}
            className="relative w-full border-2 border-gray-300"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            // Prevent default touch behavior to avoid scrolling/zooming
            style={{ touchAction: 'none' }}
          >
            <img 
              src={image.src} 
              alt="Source" 
              style={{
                width: `${imageSize.width}px`,
                height: `${imageSize.height}px`
              }}
              draggable="false"
            />

            {cropBox.width > 0 && cropBox.height > 0 && (
              <div 
                className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-30"
                style={{
                  left: `${cropBox.x}px`,
                  top: `${cropBox.y}px`,
                  width: `${cropBox.width}px`,
                  height: `${cropBox.height}px`
                }}
              />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between">
            <div className="text-sm text-gray-600 mb-2">
              {cropBox.width > 0 && cropBox.height > 0 ? (
                `Crop Area: X: ${Math.round(cropBox.x)}, Y: ${Math.round(cropBox.y)}, Width: ${Math.round(cropBox.width)}, Height: ${Math.round(cropBox.height)}`
              ) : (
                "Select an area to crop by clicking/touching and dragging"
              )}
            </div>

            <div className="flex space-x-2">
              <button 
                onClick={onCancel}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            
              {cropBox.width > 0 && cropBox.height > 0 && (
                <button 
                  onClick={handleCrop}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Apply Crop
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageCropper;