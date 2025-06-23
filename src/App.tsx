import { useState } from 'react';
import './App.css';
import ImageSelector from './components/ImageSelector';
import OCRResult from './components/OCRResult';
import ScreenCapture from './components/ScreenCapture';

function App() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string>('');
  const [ocrEngine, setOcrEngine] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [selectedImagesForStacking, setSelectedImagesForStacking] = useState<string[]>([]);
  const [stackedImage, setStackedImage] = useState<string | null>(null);
  const [stackingResult, setStackingResult] = useState<{
    originalImages: string[];
    stackedImage: string;
    timestamp: Date;
  } | null>(null);
  const [selectedArea, setSelectedArea] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  // 워크플로우 단계 관리
  const [currentStep, setCurrentStep] = useState(1);
  const [finalProcessedImage, setFinalProcessedImage] = useState<string | null>(null);
  const [preprocessSettings, setPreprocessSettings] = useState({
    enabled: true,
    scaleFactor: 2
  });

  const handleCapture = (imageUrl: string) => {
    setCapturedImage(imageUrl);
    
    // 이미지 히스토리에 추가 (최대 5개까지)
    setCapturedImages(prev => {
      const newImages = [imageUrl, ...prev.slice(0, 4)];
      return newImages;
    });
  };

  const handleOcrResult = (result: string, engine?: string) => {
    setOcrResult(result);
    if (engine) {
      setOcrEngine(engine);
    }
  };

  // 전체 초기화 함수
  const resetAll = () => {
    setCapturedImage(null);
    setOcrResult('');
    setOcrEngine('');
    setCapturedImages([]);
    setSelectedImagesForStacking([]);
    setStackedImage(null);
    setStackingResult(null);
    setSelectedArea(null);
    setIsSelecting(false);
    setCurrentStep(1);
    setFinalProcessedImage(null);
    setPreprocessSettings({
      enabled: true,
      scaleFactor: 2
    });
  };

  // 이미지 스택킹 선택 토글
  const toggleImageForStacking = (imageUrl: string) => {
    setSelectedImagesForStacking(prev => {
      if (prev.includes(imageUrl)) {
        return prev.filter(url => url !== imageUrl);
      } else {
        return [...prev, imageUrl];
      }
    });
  };

  // 이미지 세로 연결 수행
  const performImageConcatenation = async () => {
    if (selectedImagesForStacking.length < 2) {
      alert('최소 2개 이상의 이미지를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const images = await Promise.all(
        selectedImagesForStacking.map(url => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        })
      );

      if (images.length === 0) return;

      // 가장 넓은 이미지의 너비를 기준으로 설정
      const maxWidth = Math.max(...images.map(img => img.width));
      
      // 모든 이미지의 높이를 합산
      const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
      
      // 캔버스 크기 설정
      canvas.width = maxWidth;
      canvas.height = totalHeight;
      
      // 배경을 흰색으로 설정
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 이미지들을 세로로 연결
      let currentY = 0;
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // 이미지를 중앙 정렬로 배치
        const x = (maxWidth - img.width) / 2;
        
        ctx.drawImage(img, x, currentY, img.width, img.height);
        currentY += img.height;
      }

      const concatenatedImageUrl = canvas.toDataURL('image/png', 1.0);
      
      // 연결 결과 저장
      setStackingResult({
        originalImages: [...selectedImagesForStacking],
        stackedImage: concatenatedImageUrl,
        timestamp: new Date()
      });
      
      setStackedImage(concatenatedImageUrl);
      setCapturedImage(concatenatedImageUrl);
      
      // 연결된 이미지를 히스토리에 추가
      setCapturedImages(prev => [concatenatedImageUrl, ...prev.slice(0, 4)]);
      
      // 선택 해제
      setSelectedImagesForStacking([]);
      
    } catch (error) {
      console.error('이미지 연결 실패:', error);
      alert('이미지 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔍 웹 화면 캡쳐 & OCR</h1>
        <div className="header-controls">
          <button onClick={resetAll} className="reset-button">
            전체 초기화
          </button>
        </div>
      </header>

      <main className="app-main">
        {!capturedImage ? (
          <ScreenCapture
            onCapture={handleCapture}
            isLoading={isLoading}
          />
        ) : (
          <div className="workflow-container">
            {/* 단계 1: 영역 선택 */}
            {currentStep === 1 && (
              <div className="workflow-step">
                <div className="step-header">
                  <h2>🎯 단계 1: 분석할 영역 선택</h2>
                  <div className="step-controls">
                    <button
                      onClick={() => {
                        setSelectedArea(null);
                        setCurrentStep(2);
                        setFinalProcessedImage(capturedImage);
                      }}
                      className="skip-button"
                    >
                      전체 이미지 사용
                    </button>
                    <button onClick={resetAll} className="back-button">
                      처음으로
                    </button>
                  </div>
                </div>
                
                                 <ImageSelector
                   imageUrl={capturedImage}
                   onAreaSelect={(area) => {
                     setSelectedArea(area);
                     if (area) {
                       setCurrentStep(2);
                       setFinalProcessedImage(capturedImage);
                     }
                   }}
                   selectedArea={selectedArea}
                   isSelecting={isSelecting}
                   onSelectingChange={setIsSelecting}
                 />
              </div>
            )}

            {/* 단계 2: OCR 분석 */}
            {currentStep === 2 && finalProcessedImage && (
              <div className="workflow-step">
                <div className="step-header">
                  <h2>📝 단계 2: OCR 텍스트 인식</h2>
                  <div className="step-controls">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="back-button"
                    >
                      영역 다시 선택
                    </button>
                    <button onClick={resetAll} className="reset-button">
                      처음으로
                    </button>
                  </div>
                </div>
                
                                 <OCRResult
                   imageUrl={finalProcessedImage}
                   onOcrResult={handleOcrResult}
                   selectedArea={selectedArea}
                 />
              </div>
            )}

            {/* 이미지 히스토리 */}
            {capturedImages.length > 1 && (
              <div className="image-history">
                <h3>📚 이미지 히스토리</h3>
                <div className="history-grid">
                  {capturedImages.map((imageUrl, index) => (
                    <div
                      key={`${imageUrl}-${index}`}
                      className={`history-item ${
                        selectedImagesForStacking.includes(imageUrl) ? 'selected' : ''
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt={`캡쳐 ${index + 1}`}
                        onClick={() => setCapturedImage(imageUrl)}
                      />
                      <div className="history-controls">
                        <input
                          type="checkbox"
                          checked={selectedImagesForStacking.includes(imageUrl)}
                          onChange={() => toggleImageForStacking(imageUrl)}
                          id={`stack-${index}`}
                        />
                        <label htmlFor={`stack-${index}`}>연결용 선택</label>
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedImagesForStacking.length >= 2 && (
                  <button
                    onClick={performImageConcatenation}
                    className="stack-button"
                    disabled={isLoading}
                  >
                    {isLoading ? '연결 중...' : `선택된 이미지 연결 (${selectedImagesForStacking.length}개)`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 