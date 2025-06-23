import React, { useCallback, useRef, useState } from 'react';
import './ImageSelector.css';

interface ImageSelectorProps {
  imageUrl: string;
  onAreaSelect: (area: { x: number; y: number; width: number; height: number } | null) => void;
  selectedArea: { x: number; y: number; width: number; height: number } | null;
  isSelecting: boolean;
  onSelectingChange: (selecting: boolean) => void;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  imageUrl,
  onAreaSelect,
  selectedArea,
  isSelecting,
  onSelectingChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const getRelativeCoordinates = (e: React.MouseEvent) => {
    if (!containerRef.current || !imageRef.current) return { x: 0, y: 0 };
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 이미지 실제 크기 대비 표시 크기 비율 계산
    const scaleX = imageRef.current.naturalWidth / imageRef.current.offsetWidth;
    const scaleY = imageRef.current.naturalHeight / imageRef.current.offsetHeight;
    
    return {
      x: Math.max(0, Math.min(x * scaleX, imageRef.current.naturalWidth)),
      y: Math.max(0, Math.min(y * scaleY, imageRef.current.naturalHeight))
    };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isSelecting) return;
    
    e.preventDefault();
    const coords = getRelativeCoordinates(e);
    setStartPoint(coords);
    setIsDragging(true);
    onAreaSelect(null);
  }, [isSelecting, onAreaSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !startPoint || !isSelecting) return;
    
    const coords = getRelativeCoordinates(e);
    const area = {
      x: Math.min(startPoint.x, coords.x),
      y: Math.min(startPoint.y, coords.y),
      width: Math.abs(coords.x - startPoint.x),
      height: Math.abs(coords.y - startPoint.y)
    };
    
    onAreaSelect(area);
  }, [isDragging, startPoint, isSelecting, onAreaSelect]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setStartPoint(null);
    }
  }, [isDragging]);

  const clearSelection = () => {
    onAreaSelect(null);
    onSelectingChange(false);
  };

  const getDisplayArea = () => {
    if (!selectedArea || !imageRef.current) return null;
    
    const scaleX = imageRef.current.offsetWidth / imageRef.current.naturalWidth;
    const scaleY = imageRef.current.offsetHeight / imageRef.current.naturalHeight;
    
    return {
      x: selectedArea.x * scaleX,
      y: selectedArea.y * scaleY,
      width: selectedArea.width * scaleX,
      height: selectedArea.height * scaleY
    };
  };

  const displayArea = getDisplayArea();

  return (
    <div className="image-selector">
      <div className="selector-controls">
        <button
          className={`select-area-btn ${isSelecting ? 'active' : ''}`}
          onClick={() => onSelectingChange(!isSelecting)}
        >
          {isSelecting ? '🔲 선택 중...' : '🎯 영역 선택'}
        </button>
        {selectedArea && (
          <div className="selection-info">
            <span>
              선택 영역: {Math.round(selectedArea.width)} × {Math.round(selectedArea.height)}px
            </span>
            <button className="clear-selection" onClick={clearSelection}>
              ✕ 선택 해제
            </button>
          </div>
        )}
      </div>
      
      <div 
        ref={containerRef}
        className={`image-container ${isSelecting ? 'selecting' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          ref={imageRef}
          src={imageUrl} 
          alt="Captured screen" 
          className="selectable-image"
          draggable={false}
        />
        
        {displayArea && (
          <div 
            className="selection-overlay"
            style={{
              left: displayArea.x,
              top: displayArea.y,
              width: displayArea.width,
              height: displayArea.height
            }}
          >
            <div className="selection-border"></div>
            <div className="selection-corners">
              <div className="corner top-left"></div>
              <div className="corner top-right"></div>
              <div className="corner bottom-left"></div>
              <div className="corner bottom-right"></div>
            </div>
          </div>
        )}
        
        {isSelecting && !selectedArea && (
          <div className="selection-hint">
            마우스로 드래그하여 분석할 영역을 선택하세요
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageSelector; 